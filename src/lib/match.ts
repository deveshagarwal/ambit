import { aiEnabled, chatJSON } from "./ai";
import { allAttributes, getMember } from "./store/repo";
import { rankByOfferSimilarity } from "./store/vector";
import { expand } from "./store/graph";
import { MatchRanking, type Member, type NeedParse } from "./types";

export interface Match {
  member: Member;
  score: number;
  reason: string;
  sharedTags: string[];
}

export async function findMatches(
  askerId: string,
  need: NeedParse,
  limit = 5,
): Promise<Match[]> {
  // 1. Offer-side vector similarity over the whole community.
  const ranked = await rankByOfferSimilarity(
    `${need.summary} ${need.tags.join(" ")}`,
    askerId,
  );

  // 2. Light graph trust boost: people close to the asker rank a little higher.
  const reach = await expand([askerId], 2);
  const window = ranked.slice(0, 24).map((r) => {
    const depth = reach.get(r.memberId);
    const boost = depth === 1 ? 0.06 : depth === 2 ? 0.03 : 0;
    return { ...r, sim: r.sim + boost };
  });
  window.sort((a, b) => b.sim - a.sim);

  const pool = window.filter((r) => r.sim > 0).slice(0, 12);
  const fallbackPool = pool.length > 0 ? pool : window.slice(0, 8);

  // Attribute context for reasons and the optional LLM rerank.
  const attrs = await allAttributes();
  const byMember = new Map<string, { tags: string[]; values: string[] }>();
  for (const a of attrs) {
    const e = byMember.get(a.member_id) ?? { tags: [], values: [] };
    e.tags.push(a.tag);
    e.values.push(`${a.type}: ${a.value}`);
    byMember.set(a.member_id, e);
  }
  const sharedFor = (id: string) =>
    need.tags.filter((t) =>
      (byMember.get(id)?.tags ?? []).some((c) => c === t || c.includes(t) || t.includes(c)),
    );

  // No AI key: cosine ranking with a templated reason.
  if (!aiEnabled()) {
    const out: Match[] = [];
    for (const r of fallbackPool.slice(0, limit)) {
      const member = await getMember(r.memberId);
      if (!member) continue;
      const shared = sharedFor(r.memberId);
      out.push({
        member,
        score: Math.round(Math.min(96, 45 + r.sim * 55)),
        reason:
          shared.length > 0
            ? `Strong overlap on ${shared.slice(0, 3).join(", ")}.`
            : member.headline,
        sharedTags: shared,
      });
    }
    return out;
  }

  // AI rerank over the shortlist with full attribute context.
  try {
    const members = new Map<string, Member>();
    const lines: string[] = [];
    for (const r of fallbackPool) {
      const m = await getMember(r.memberId);
      if (!m) continue;
      members.set(m.id, m);
      const ctx = byMember.get(m.id)?.values.join("; ") ?? "";
      lines.push(`id=${m.id} | ${m.name} - ${m.headline}\n  ${ctx}`);
    }
    const raw = await chatJSON<MatchRanking>([
      {
        role: "system",
        content: `You match a member's request to the best people in a networking community.
Given the request and candidate profiles, return the top ${limit} who can genuinely help.
Return JSON: { "matches": [{ "member_id": string, "score": number 0-100, "reason": string }] }.
The reason must be specific about WHY this person fits (cite their actual offers/experience). Order by score desc.`,
      },
      {
        role: "user",
        content: `REQUEST: ${need.summary}\nTAGS: ${need.tags.join(", ")}\n\nCANDIDATES:\n${lines.join("\n")}`,
      },
    ]);
    const ranking = MatchRanking.parse(raw);
    const result: Match[] = [];
    for (const r of ranking.matches.slice(0, limit)) {
      const member = members.get(r.member_id);
      if (!member) continue;
      result.push({
        member,
        score: Math.round(r.score),
        reason: r.reason,
        sharedTags: sharedFor(r.member_id),
      });
    }
    if (result.length > 0) return result;
  } catch {
    // fall through to cosine ranking
  }

  const out: Match[] = [];
  for (const r of fallbackPool.slice(0, limit)) {
    const member = await getMember(r.memberId);
    if (!member) continue;
    const shared = sharedFor(r.memberId);
    out.push({
      member,
      score: Math.round(Math.min(96, 45 + r.sim * 55)),
      reason: shared.length > 0 ? `Overlap on ${shared.slice(0, 3).join(", ")}.` : member.headline,
      sharedTags: shared,
    });
  }
  return out;
}
