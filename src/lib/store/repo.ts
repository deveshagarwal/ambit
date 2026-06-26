import { nanoid } from "nanoid";
import { query, queryOne } from "./client";
import { normalizeTag } from "../text";
import type {
  Attribute,
  AttributeType,
  Ask,
  Connection,
  KarmaEvent,
  Member,
} from "../types";

// ---- Members ----

const MEMBER_COLS = `id, name, headline, bio, karma, is_synthetic, created_at::text AS created_at`;

export async function createMember(input: {
  name: string;
  headline: string;
  bio: string;
  isSynthetic?: boolean;
  karma?: number;
}): Promise<Member> {
  const row = await queryOne<Member>(
    `INSERT INTO members (id, name, headline, bio, karma, is_synthetic)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${MEMBER_COLS}`,
    [
      nanoid(10),
      input.name,
      input.headline,
      input.bio,
      input.karma ?? 0,
      input.isSynthetic ?? false,
    ],
  );
  return row!;
}

export async function getMember(id: string): Promise<Member | undefined> {
  return queryOne<Member>(`SELECT ${MEMBER_COLS} FROM members WHERE id = $1`, [id]);
}

export async function listMembers(): Promise<Member[]> {
  return query<Member>(`SELECT ${MEMBER_COLS} FROM members ORDER BY karma DESC`);
}

export async function memberCount(): Promise<number> {
  const r = await queryOne<{ c: number }>(`SELECT COUNT(*)::int AS c FROM members`);
  return r?.c ?? 0;
}

// ---- Facts (reified, confidence-scored, bitemporal edges) ----
// Exposed in the legacy Attribute shape (type = predicate, value = object_value)
// so callers do not need to know about the edge model.

const ATTR_SELECT = `id, subject_id AS member_id, predicate AS type, object_value AS value, tag, weight`;
const ACTIVE = `invalidated_at IS NULL AND (valid_to IS NULL OR valid_to > now())`;

export async function addAttributes(
  memberId: string,
  attrs: {
    type: AttributeType;
    value: string;
    weight?: number;
    confidence?: number;
    source?: string;
  }[],
): Promise<void> {
  for (const a of attrs) {
    if (!a.value?.trim()) continue;
    await query(
      `INSERT INTO edges (id, subject_id, predicate, object_value, tag, weight, confidence, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        nanoid(10),
        memberId,
        a.type,
        a.value.trim(),
        normalizeTag(a.value),
        a.weight ?? 1,
        a.confidence ?? 1,
        a.source ?? "self",
      ],
    );
  }
}

export async function getAttributes(memberId: string): Promise<Attribute[]> {
  return query<Attribute>(
    `SELECT ${ATTR_SELECT} FROM edges WHERE subject_id = $1 AND ${ACTIVE}`,
    [memberId],
  );
}

export async function allAttributes(): Promise<Attribute[]> {
  return query<Attribute>(`SELECT ${ATTR_SELECT} FROM edges WHERE ${ACTIVE}`);
}

// ---- Asks ----

const ASK_COLS = `id, member_id, text, tags, status, created_at::text AS created_at`;

export async function createAsk(memberId: string, text: string, tags: string[]): Promise<Ask> {
  const row = await queryOne<Ask>(
    `INSERT INTO asks (id, member_id, text, tags) VALUES ($1,$2,$3,$4)
     RETURNING ${ASK_COLS}`,
    [nanoid(10), memberId, text, JSON.stringify(tags)],
  );
  return row!;
}

export async function getAsksFor(memberId: string): Promise<Ask[]> {
  return query<Ask>(
    `SELECT ${ASK_COLS} FROM asks WHERE member_id = $1 ORDER BY created_at DESC`,
    [memberId],
  );
}

export async function openAsksFromOthers(memberId: string): Promise<Ask[]> {
  return query<Ask>(
    `SELECT ${ASK_COLS} FROM asks WHERE member_id <> $1 AND status = 'open'
     ORDER BY created_at DESC LIMIT 50`,
    [memberId],
  );
}

// ---- Connections ----

const CONN_COLS = `id, from_member, to_member, reason, ask_id, created_at::text AS created_at`;

export async function createConnection(input: {
  from: string;
  to: string;
  reason: string;
  askId?: string | null;
  confidence?: number;
}): Promise<Connection> {
  const row = await queryOne<Connection>(
    `INSERT INTO connections (id, from_member, to_member, reason, ask_id, confidence)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${CONN_COLS}`,
    [nanoid(10), input.from, input.to, input.reason, input.askId ?? null, input.confidence ?? 1],
  );
  return row!;
}

export async function getConnectionsFor(memberId: string): Promise<Connection[]> {
  return query<Connection>(
    `SELECT ${CONN_COLS} FROM connections
     WHERE from_member = $1 OR to_member = $1 ORDER BY created_at DESC`,
    [memberId],
  );
}

export async function allConnections(): Promise<Connection[]> {
  return query<Connection>(`SELECT ${CONN_COLS} FROM connections ORDER BY created_at DESC`);
}

// ---- Karma ----

const KARMA_COLS = `id, member_id, delta, reason, related_member, created_at::text AS created_at`;

export async function addKarma(
  memberId: string,
  delta: number,
  reason: string,
  relatedMember?: string | null,
): Promise<void> {
  // Single statement keeps the event insert and the running total atomic.
  await query(
    `WITH k AS (
       INSERT INTO karma_events (id, member_id, delta, reason, related_member)
       VALUES ($1,$2,$3,$4,$5)
     )
     UPDATE members SET karma = karma + $3 WHERE id = $2`,
    [nanoid(10), memberId, delta, reason, relatedMember ?? null],
  );
}

export async function getKarmaEvents(memberId: string): Promise<KarmaEvent[]> {
  return query<KarmaEvent>(
    `SELECT ${KARMA_COLS} FROM karma_events WHERE member_id = $1
     ORDER BY created_at DESC LIMIT 30`,
    [memberId],
  );
}

// ---- Outcomes (the feedback-loop log) ----

export async function logOutcome(input: {
  askerId: string;
  targetId?: string | null;
  askId?: string | null;
  action: "surfaced" | "intro_requested" | "accepted" | "declined";
  score?: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO outcomes (id, asker_id, target_id, ask_id, action, score)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      nanoid(10),
      input.askerId,
      input.targetId ?? null,
      input.askId ?? null,
      input.action,
      input.score ?? null,
    ],
  );
}

export async function recentActivity(limit = 12): Promise<
  { kind: string; a: string; b: string | null; text: string | null; ts: string }[]
> {
  // Community heartbeat: recent connections, joins, and cred events as one stream.
  return query(
    `
    SELECT 'connection' AS kind, from_member AS a, to_member AS b, NULL::text AS text, created_at::text AS ts
      FROM connections
    UNION ALL
    SELECT 'joined' AS kind, id AS a, NULL AS b, headline AS text, created_at::text AS ts
      FROM members WHERE is_synthetic = false
    UNION ALL
    SELECT 'cred' AS kind, member_id AS a, related_member AS b, reason AS text, created_at::text AS ts
      FROM karma_events WHERE delta > 0
    ORDER BY ts DESC
    LIMIT $1
    `,
    [limit],
  );
}
