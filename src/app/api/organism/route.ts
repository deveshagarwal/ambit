import { NextResponse } from "next/server";
import { organismTurn, parseNeed, type ChatMsg } from "@/lib/agent";
import { findMatches } from "@/lib/match";
import { createAsk, getAttributes, logOutcome } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureSeeded();
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { history } = (await req.json()) as { history: ChatMsg[] };
  const turns = Array.isArray(history) ? history : [];

  const result = await organismTurn(turns);

  if (result.intent === "need" && result.query) {
    const need = await parseNeed(result.query);
    const matches = await findMatches(memberId, need, 5);
    const ask = await createAsk(memberId, result.query, need.tags);

    const enriched = await Promise.all(
      matches.map(async (m) => {
        await logOutcome({
          askerId: memberId,
          targetId: m.member.id,
          askId: ask.id,
          action: "surfaced",
          score: m.score,
        });
        return {
          member: m.member,
          score: m.score,
          reason: m.reason,
          sharedTags: m.sharedTags,
          attributes: (await getAttributes(m.member.id)).map((a) => ({
            type: a.type,
            value: a.value,
          })),
        };
      }),
    );

    return NextResponse.json({ reply: result.reply, intent: result.intent, matches: enriched });
  }

  return NextResponse.json({
    reply: result.reply,
    intent: result.intent,
    matches: [],
  });
}
