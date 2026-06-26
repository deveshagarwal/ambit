import { NextResponse } from "next/server";
import { createConnection, getMember, logOutcome } from "@/lib/store/repo";
import { awardConnection } from "@/lib/karma";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { toMemberId, reason, askId } = (await req.json()) as {
    toMemberId: string;
    reason?: string;
    askId?: string | null;
  };
  const target = await getMember(toMemberId);
  if (!target) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }

  const connection = await createConnection({
    from: memberId,
    to: toMemberId,
    reason: reason ?? "",
    askId: askId ?? null,
  });
  await awardConnection(toMemberId, memberId);
  await logOutcome({
    askerId: memberId,
    targetId: toMemberId,
    askId: askId ?? null,
    action: "intro_requested",
  });

  return NextResponse.json({ connection, helper: await getMember(toMemberId) });
}
