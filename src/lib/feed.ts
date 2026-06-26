import { query } from "./store/client";
import { getAttributes, getMember } from "./store/repo";
import { tagOverlap } from "./text";
import type { Ask, Connection, KarmaEvent, Member } from "./types";

// The always-alive feed. Ambient reciprocity moments stitched together from the
// living graph: people you can help, people who can help you, and the community
// breathing in the background so the organism never looks dead.

export type FeedItem = {
  id: string;
  kind: "you_can_help" | "could_help_you" | "connection" | "cred" | "joined";
  text: string;
  sub?: string;
  href?: string;
  ts: string;
};

const TOP_YOU_CAN_HELP = 4;
const TOP_COULD_HELP_YOU = 3;
const RECENT_CONNECTIONS = 4;
const RECENT_CRED = 4;
const RECENT_JOINED = 4;
const TOTAL_CAP = 12;

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
  } catch {
    // tags should always be valid json, but never let a bad row kill the feed
  }
  return [];
}

export async function buildFeed(memberId: string): Promise<FeedItem[]> {
  const nameCache = new Map<string, Member | undefined>();
  const nameFor = async (id: string): Promise<string> => {
    if (!nameCache.has(id)) nameCache.set(id, await getMember(id));
    return nameCache.get(id)?.name ?? "Someone";
  };

  const mine = (await getAttributes(memberId))
    .filter((a) => a.type === "offer")
    .map((a) => a.tag)
    .filter(Boolean);

  // ---- you_can_help: open asks from others my offers match ----
  const otherOpenAsks = await query<Ask>(
    `SELECT id, member_id, text, tags, status, created_at::text AS created_at
     FROM asks WHERE member_id <> $1 AND status = 'open' ORDER BY created_at DESC LIMIT 60`,
    [memberId],
  );
  const youCanHelpRanked = otherOpenAsks
    .map((ask) => ({ ask, overlap: tagOverlap(parseTags(ask.tags), mine) }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, TOP_YOU_CAN_HELP);
  const youCanHelp: FeedItem[] = [];
  for (const { ask } of youCanHelpRanked) {
    youCanHelp.push({
      id: `help-${ask.id}`,
      kind: "you_can_help",
      text: `${await nameFor(ask.member_id)} is looking for help`,
      sub: ask.text,
      href: "/ask",
      ts: ask.created_at,
    });
  }

  // ---- could_help_you: my open asks others can answer ----
  const myOpenAsks = await query<Ask>(
    `SELECT id, member_id, text, tags, status, created_at::text AS created_at
     FROM asks WHERE member_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 20`,
    [memberId],
  );
  const couldHelpYou: FeedItem[] = [];
  if (myOpenAsks.length > 0) {
    const otherOffers = await query<{ member_id: string; tag: string }>(
      `SELECT subject_id AS member_id, tag FROM edges
       WHERE predicate = 'offer' AND subject_id <> $1 AND invalidated_at IS NULL`,
      [memberId],
    );
    for (const ask of myOpenAsks) {
      const askTags = parseTags(ask.tags);
      if (askTags.length === 0) continue;
      const helpers = new Set<string>();
      for (const off of otherOffers) {
        if (off.tag && tagOverlap(askTags, [off.tag]) > 0) helpers.add(off.member_id);
      }
      if (helpers.size > 0) {
        const n = helpers.size;
        couldHelpYou.push({
          id: `mine-${ask.id}`,
          kind: "could_help_you",
          text: `${n} ${n === 1 ? "person" : "people"} can help with your ask`,
          sub: ask.text,
          href: "/ask",
          ts: ask.created_at,
        });
      }
      if (couldHelpYou.length >= TOP_COULD_HELP_YOU) break;
    }
  }

  // ---- connection: the community weaving together ----
  const recentConnections = await query<Connection>(
    `SELECT id, from_member, to_member, reason, ask_id, created_at::text AS created_at
     FROM connections ORDER BY created_at DESC LIMIT $1`,
    [RECENT_CONNECTIONS],
  );
  const connectionItems: FeedItem[] = [];
  for (const c of recentConnections) {
    connectionItems.push({
      id: `conn-${c.id}`,
      kind: "connection",
      text: `${await nameFor(c.from_member)} connected with ${await nameFor(c.to_member)}`,
      sub: c.reason || undefined,
      ts: c.created_at,
    });
  }

  // ---- cred: others earning karma for helping ----
  const recentCred = await query<KarmaEvent>(
    `SELECT id, member_id, delta, reason, related_member, created_at::text AS created_at
     FROM karma_events WHERE delta > 0 AND member_id <> $1 ORDER BY created_at DESC LIMIT $2`,
    [memberId, RECENT_CRED],
  );
  const credItems: FeedItem[] = [];
  for (const k of recentCred) {
    credItems.push({
      id: `cred-${k.id}`,
      kind: "cred",
      text: `${await nameFor(k.member_id)} earned cred helping the network`,
      sub: `+${k.delta} cred`,
      ts: k.created_at,
    });
  }

  // ---- joined: fresh faces ----
  const recentMembers = await query<Member>(
    `SELECT id, name, headline, created_at::text AS created_at
     FROM members WHERE id <> $1 ORDER BY created_at DESC LIMIT $2`,
    [memberId, RECENT_JOINED],
  );
  const joinedItems: FeedItem[] = recentMembers.map((m) => ({
    id: `joined-${m.id}`,
    kind: "joined",
    text: `${m.name} joined the network`,
    sub: m.headline || undefined,
    ts: m.created_at,
  }));

  const ambient = [...connectionItems, ...credItems, ...joinedItems, ...couldHelpYou].sort((a, b) =>
    a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0,
  );
  const personalizedLead = [...youCanHelp, ...couldHelpYou].slice(0, 3);
  const leadIds = new Set(personalizedLead.map((i) => i.id));
  const rest = ambient.filter((i) => !leadIds.has(i.id));
  return [...personalizedLead, ...rest].slice(0, TOTAL_CAP);
}
