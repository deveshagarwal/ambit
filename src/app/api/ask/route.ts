import { NextResponse } from "next/server";
import { parseNeed } from "@/lib/agent";
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
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "empty ask" }, { status: 400 });
  }

  const need = await parseNeed(text);
  const matches = await findMatches(memberId, need, 5);
  const ask = await createAsk(memberId, text, need.tags);

  const enriched = await Promise.all(
    matches.map(async (m) => {
      await logOutcome({
        askerId: memberId,
        targetId: m.member.id,
        askId: ask.id,
        action: "surfaced",
        score: m.score,
      });
      const attributes = (await getAttributes(m.member.id)).map((a) => ({
        type: a.type,
        value: a.value,
      }));
      return {
        member: m.member,
        score: m.score,
        reason: m.reason,
        sharedTags: m.sharedTags,
        attributes,
      };
    }),
  );

  return NextResponse.json({ ask, need, matches: enriched });
}
