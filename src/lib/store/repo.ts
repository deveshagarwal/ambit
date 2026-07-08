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
  clerkUserId?: string | null;
  profileText?: string | null;
}): Promise<Member> {
  const row = await queryOne<Member>(
    `INSERT INTO members (id, name, headline, bio, karma, is_synthetic, clerk_user_id, profile_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${MEMBER_COLS}`,
    [
      nanoid(10),
      input.name,
      input.headline,
      input.bio,
      input.karma ?? 0,
      input.isSynthetic ?? false,
      input.clerkUserId ?? null,
      input.profileText ?? null,
    ],
  );
  return row!;
}

// Store/refresh the raw uploaded résumé/LinkedIn text for a member.
export async function setProfileText(memberId: string, text: string): Promise<void> {
  await query(`UPDATE members SET profile_text = $2 WHERE id = $1`, [memberId, text]);
}

export async function getMember(id: string): Promise<Member | undefined> {
  return queryOne<Member>(`SELECT ${MEMBER_COLS} FROM members WHERE id = $1`, [id]);
}

export async function getMemberByClerkId(clerkUserId: string): Promise<Member | undefined> {
  return queryOne<Member>(
    `SELECT ${MEMBER_COLS} FROM members WHERE clerk_user_id = $1`,
    [clerkUserId],
  );
}

export async function listMembers(): Promise<Member[]> {
  return query<Member>(`SELECT ${MEMBER_COLS} FROM members ORDER BY karma DESC`);
}

export async function memberCount(): Promise<number> {
  const r = await queryOne<{ c: number }>(`SELECT COUNT(*)::int AS c FROM members`);
  return r?.c ?? 0;
}

// A cheap fingerprint of the graph's matchable state: member count, active-edge
// count, and the newest add/invalidate timestamp. Any profile change (new member,
// added fact, invalidated fact, re-onboard) changes it, so caches keyed on this
// rebuild when they should — unlike keying on member count alone, which misses
// every persona edit.
export async function graphVersion(): Promise<string> {
  const r = await queryOne<{ m: number; e: number; t: string }>(
    `SELECT
       (SELECT COUNT(*) FROM members)::int AS m,
       (SELECT COUNT(*) FROM edges WHERE invalidated_at IS NULL)::int AS e,
       COALESCE(
         (SELECT EXTRACT(EPOCH FROM GREATEST(MAX(recorded_at), MAX(invalidated_at)))::bigint
          FROM edges), 0) AS t`,
  );
  return `${r?.m ?? 0}:${r?.e ?? 0}:${r?.t ?? 0}`;
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

// Add a single fact and return it (with its id), for the persona editor.
export async function addAttribute(
  memberId: string,
  attr: { type: AttributeType; value: string; source?: string },
): Promise<Attribute> {
  const row = await queryOne<Attribute>(
    `INSERT INTO edges (id, subject_id, predicate, object_value, tag, source)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${ATTR_SELECT}`,
    [nanoid(10), memberId, attr.type, attr.value.trim(), normalizeTag(attr.value), attr.source ?? "self"],
  );
  return row!;
}

// Invalidate (soft-delete) a fact the member owns. Bitemporal: history is kept.
export async function invalidateEdge(id: string, memberId: string): Promise<void> {
  await query(
    `UPDATE edges SET invalidated_at = now()
     WHERE id = $1 AND subject_id = $2 AND invalidated_at IS NULL`,
    [id, memberId],
  );
}

export async function updateMemberProfile(
  memberId: string,
  input: { name: string; headline: string },
): Promise<void> {
  await query(`UPDATE members SET name = $2, headline = $3 WHERE id = $1`, [
    memberId,
    input.name,
    input.headline,
  ]);
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

// An ask with its requester's display fields, for the admin requests view.
export interface AdminAsk extends Ask {
  member_name: string;
  member_headline: string;
}

// Every ask across the whole community, newest first — admin-only surface for the
// founder to review requests and source people for them.
export async function listAllAsks(limit = 200): Promise<AdminAsk[]> {
  return query<AdminAsk>(
    `SELECT a.id, a.member_id, a.text, a.tags, a.status, a.created_at::text AS created_at,
            m.name AS member_name, m.headline AS member_headline
     FROM asks a JOIN members m ON m.id = a.member_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit],
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

// True if the two members are already connected (in either direction).
export async function areConnected(a: string, b: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM connections
     WHERE (from_member = $1 AND to_member = $2) OR (from_member = $2 AND to_member = $1)
     LIMIT 1`,
    [a, b],
  );
  return !!row;
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

// ---- Intro requests ----

export interface IntroRequest {
  id: string;
  from_member: string;
  to_member: string;
  reason: string;
  ask_id: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export async function createIntroRequest(input: {
  from: string;
  to: string;
  reason: string;
  askId?: string | null;
}): Promise<IntroRequest> {
  const row = await queryOne<IntroRequest>(
    `INSERT INTO intro_requests (id, from_member, to_member, reason, ask_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, from_member, to_member, reason, ask_id, status, created_at::text AS created_at`,
    [nanoid(10), input.from, input.to, input.reason, input.askId ?? null],
  );
  return row!;
}

// True if there is already a pending request from -> to (avoid duplicates).
export async function pendingRequestExists(from: string, to: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM intro_requests
     WHERE from_member = $1 AND to_member = $2 AND status = 'pending' LIMIT 1`,
    [from, to],
  );
  return !!row;
}

export async function getIntroRequest(id: string): Promise<IntroRequest | undefined> {
  return queryOne<IntroRequest>(
    `SELECT id, from_member, to_member, reason, ask_id, status, created_at::text AS created_at
     FROM intro_requests WHERE id = $1`,
    [id],
  );
}

// Pending requests addressed to a member, with the asker's name/headline.
export async function incomingRequests(
  memberId: string,
): Promise<(IntroRequest & { from_name: string; from_headline: string })[]> {
  return query(
    `SELECT r.id, r.from_member, r.to_member, r.reason, r.ask_id, r.status,
            r.created_at::text AS created_at, m.name AS from_name, m.headline AS from_headline
     FROM intro_requests r JOIN members m ON m.id = r.from_member
     WHERE r.to_member = $1 AND r.status = 'pending'
     ORDER BY r.created_at DESC`,
    [memberId],
  );
}

// Flip a request from pending to accepted/declined. Compare-and-set: only a
// still-pending request is updated, and we return whether THIS call did it, so
// two concurrent accepts (e.g. a double-click) can't both create a connection
// and double-award karma.
export async function setRequestStatus(
  id: string,
  status: "accepted" | "declined",
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE intro_requests SET status = $2, responded_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [id, status],
  );
  return !!row;
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

// Targets who already declined this asker's intro request. Cheap read of the
// outcomes log so matching stops re-surfacing people who said no.
export async function declinedTargetIds(askerId: string): Promise<string[]> {
  const rows = await query<{ target_id: string }>(
    `SELECT DISTINCT target_id FROM outcomes
     WHERE asker_id = $1 AND action = 'declined' AND target_id IS NOT NULL`,
    [askerId],
  );
  return rows.map((r) => r.target_id);
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
