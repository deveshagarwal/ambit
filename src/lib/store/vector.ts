import { allAttributes, graphVersion, listMembers } from "./repo";
import { keywordTags } from "../text";
import type { AttributeType } from "../types";

// VectorStore + Embedder seam.
//
// Implement-now: a homegrown TF-IDF embedder, vectors held sparsely in memory,
// ranked by cosine in JS. Offer-side asymmetry is baked in: a member's vector is
// built from what they can PROVIDE (offers, skills, experience, industry,
// interest), so an incoming need matches an offer, not a similar need.
//
// Swap-later (no caller change): replace the embedder with a hosted model and
// the search with pgvector / Qdrant behind this same module.

type Sparse = Map<string, number>;

const OFFER_WEIGHT: Partial<Record<AttributeType, number>> = {
  offer: 1.6,
  skill: 1.3,
  industry: 1.2,
  experience: 1.1,
  interest: 0.9,
};
const HEADLINE_WEIGHT = 0.6;

interface Index {
  version: string;
  idf: Map<string, number>;
  vectors: Map<string, Sparse>;
}

let cache: Index | null = null;

function normalize(v: Sparse): Sparse {
  let sum = 0;
  for (const x of v.values()) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  for (const [k, x] of v) v.set(k, x / norm);
  return v;
}

async function build(version: string): Promise<Index> {
  const members = await listMembers();
  const attrs = await allAttributes();

  const tokensByMember = new Map<string, Map<string, number>>();
  const add = (member: string, text: string, weight: number) => {
    const bag = tokensByMember.get(member) ?? new Map<string, number>();
    for (const t of keywordTags(text)) bag.set(t, (bag.get(t) ?? 0) + weight);
    tokensByMember.set(member, bag);
  };

  for (const m of members) add(m.id, m.headline, HEADLINE_WEIGHT);
  for (const a of attrs) {
    const w = OFFER_WEIGHT[a.type];
    if (w) add(a.member_id, a.value, w);
  }

  // Document frequency across members -> IDF.
  const df = new Map<string, number>();
  for (const bag of tokensByMember.values()) {
    for (const t of bag.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = members.length || 1;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((1 + N) / (1 + d)) + 1);

  const vectors = new Map<string, Sparse>();
  for (const [member, bag] of tokensByMember) {
    const v: Sparse = new Map();
    for (const [t, tf] of bag) v.set(t, tf * (idf.get(t) ?? 1));
    vectors.set(member, normalize(v));
  }

  return { version, idf, vectors };
}

async function index(): Promise<Index> {
  const version = await graphVersion();
  if (!cache || cache.version !== version) cache = await build(version);
  return cache;
}

function embedWith(idf: Map<string, number>, text: string): Sparse {
  const v: Sparse = new Map();
  for (const t of keywordTags(text)) v.set(t, (v.get(t) ?? 0) + (idf.get(t) ?? 1));
  return normalize(v);
}

function cosine(a: Sparse, b: Sparse): number {
  // both are L2-normalized, so the dot product is the cosine
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) {
    const y = large.get(k);
    if (y) dot += x * y;
  }
  return dot;
}

// Rank everyone (except the asker) by how well their offer-side vector matches
// the need text. Returns sorted descending.
export async function rankByOfferSimilarity(
  queryText: string,
  excludeId: string,
): Promise<{ memberId: string; sim: number }[]> {
  const idx = await index();
  const qv = embedWith(idx.idf, queryText);
  const ranked: { memberId: string; sim: number }[] = [];
  for (const [memberId, vec] of idx.vectors) {
    if (memberId === excludeId) continue;
    ranked.push({ memberId, sim: cosine(qv, vec) });
  }
  ranked.sort((a, b) => b.sim - a.sim);
  return ranked;
}
