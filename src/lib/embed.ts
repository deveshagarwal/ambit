import { allAttributes, listMembers, memberCount } from "./store/repo";
import { keywordTags } from "./text";
import type { AttributeType, Member } from "./types";

// Real, data-derived embeddings. Each member becomes a sparse TF-IDF vector over
// the token vocabulary mined from their attribute values and headline, weighted by
// attribute type. Vectors are L2-normalized so cosine is a plain dot product. A
// deterministic hash-seeded projection drops the sparse vectors into 3-d for the viz.

const TYPE_WEIGHT: Record<AttributeType, number> = {
  offer: 1.6,
  need: 1.4,
  skill: 1.3,
  industry: 1.2,
  experience: 1.1,
  company: 1.0,
  school: 0.8,
  interest: 0.9,
};
const HEADLINE_WEIGHT = 0.6;

export type SparseVec = Map<string, number>;

interface Index {
  count: number;
  idf: Map<string, number>;
  vectors: Map<string, SparseVec>;
  members: Member[];
}

let _index: Index | null = null;

// Accumulate weighted raw term counts for a single bag of tokens.
function addTokens(target: Map<string, number>, tokens: string[], weight: number): void {
  for (const t of tokens) {
    target.set(t, (target.get(t) ?? 0) + weight);
  }
}

function l2normalize(vec: Map<string, number>): SparseVec {
  let sumSq = 0;
  for (const v of vec.values()) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return new Map();
  const out: SparseVec = new Map();
  for (const [k, v] of vec) out.set(k, v / norm);
  return out;
}

async function buildIndex(): Promise<Index> {
  const members = await listMembers();
  const attrs = await allAttributes();

  // Group raw weighted term frequencies per member.
  const byMember = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();

  const ensure = (id: string): Map<string, number> => {
    let m = byMember.get(id);
    if (!m) {
      m = new Map();
      byMember.set(id, m);
    }
    return m;
  };

  for (const a of attrs) {
    const tokens = keywordTags(a.value);
    if (tokens.length === 0) continue;
    addTokens(ensure(a.member_id), tokens, TYPE_WEIGHT[a.type] ?? 1);
  }
  for (const m of members) {
    const tokens = keywordTags(m.headline);
    if (tokens.length === 0) continue;
    addTokens(ensure(m.id), tokens, HEADLINE_WEIGHT);
  }

  // Document frequency over the (deduped) token set of each member.
  for (const tf of byMember.values()) {
    for (const token of tf.keys()) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const N = members.length;
  const idf = new Map<string, number>();
  for (const [token, d] of df) {
    idf.set(token, Math.log((1 + N) / (1 + d)) + 1);
  }

  // TF-IDF then L2-normalize each member vector.
  const vectors = new Map<string, SparseVec>();
  for (const m of members) {
    const tf = byMember.get(m.id);
    if (!tf) {
      vectors.set(m.id, new Map());
      continue;
    }
    const tfidf = new Map<string, number>();
    for (const [token, count] of tf) {
      tfidf.set(token, count * (idf.get(token) ?? 1));
    }
    vectors.set(m.id, l2normalize(tfidf));
  }

  return { count: members.length, idf, vectors, members };
}

async function index(): Promise<Index> {
  const count = await memberCount();
  if (!_index || _index.count !== count) {
    _index = await buildIndex();
  }
  return _index;
}

export async function memberVector(id: string): Promise<SparseVec> {
  return (await index()).vectors.get(id) ?? new Map();
}

// Embed arbitrary text into the same space using the cached IDF weights.
export async function embedText(text: string): Promise<SparseVec> {
  const idx = await index();
  const tokens = keywordTags(text);
  const tf = new Map<string, number>();
  addTokens(tf, tokens, 1);
  const tfidf = new Map<string, number>();
  for (const [token, count] of tf) {
    tfidf.set(token, count * (idx.idf.get(token) ?? 1));
  }
  return l2normalize(tfidf);
}

export function cosine(a: SparseVec, b: SparseVec): number {
  // Both inputs are L2-normalized, so cosine is just the dot product. Iterate the
  // smaller map for speed.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w !== undefined) dot += v * w;
  }
  return dot;
}

// ---- Deterministic projection to 3-d ----

function hashString(s: string): number {
  // FNV-1a 32-bit hash, used to seed the per-token PRNG.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller gaussian from two uniforms.
function gaussianPair(rand: () => number): [number, number] {
  let u1 = rand();
  const u2 = rand();
  if (u1 < 1e-9) u1 = 1e-9;
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

const _tokenVec3 = new Map<string, [number, number, number]>();

// Stable 3-d basis vector for a token, derived from its hash.
function tokenVec3(token: string): [number, number, number] {
  const cached = _tokenVec3.get(token);
  if (cached) return cached;
  const rand = mulberry32(hashString(token));
  const [g0, g1] = gaussianPair(rand);
  const [g2] = gaussianPair(rand);
  const v: [number, number, number] = [g0, g1, g2];
  _tokenVec3.set(token, v);
  return v;
}

export function project(vec: SparseVec): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [token, w] of vec) {
    const tv = tokenVec3(token);
    x += w * tv[0];
    y += w * tv[1];
    z += w * tv[2];
  }
  return [x, y, z];
}

export interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
}

export async function projectAll(): Promise<ProjectedPoint[]> {
  const idx = await index();
  const raw: ProjectedPoint[] = idx.members.map((m) => {
    const [x, y, z] = project(idx.vectors.get(m.id) ?? new Map());
    return { id: m.id, x, y, z };
  });

  if (raw.length === 0) return raw;

  // Standardize per axis so the cloud spreads regardless of vector magnitude.
  const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
  for (const axis of axes) {
    let mean = 0;
    for (const p of raw) mean += p[axis];
    mean /= raw.length;
    let variance = 0;
    for (const p of raw) variance += (p[axis] - mean) ** 2;
    variance /= raw.length;
    const std = Math.sqrt(variance) || 1;
    for (const p of raw) p[axis] = (p[axis] - mean) / std;
  }

  return raw;
}

// Stable hue 0-360 from the headline so same-archetype synthetic members share a color.
export function hueForMember(member: Member): number {
  return hashString(member.headline) % 360;
}

// The k members whose full vectors are closest to a given member (for the viz).
export async function nearestTo(selfId: string, k: number): Promise<string[]> {
  const idx = await index();
  const selfVec = idx.vectors.get(selfId) ?? new Map();
  return idx.members
    .filter((m) => m.id !== selfId)
    .map((m) => ({ id: m.id, sim: cosine(selfVec, idx.vectors.get(m.id) ?? new Map()) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k)
    .map((n) => n.id);
}
