import { NextResponse } from "next/server";
import {
  createConnection,
  createIntroRequest,
  getMember,
  logOutcome,
  setRequestStatus,
} from "@/lib/store/repo";
import { awardConnection } from "@/lib/karma";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// Send an intro request. Real members get a pending request they accept from
// their inbox. Synthetic (seed) members can't log in to accept, so those are
// auto-accepted, so the loop still completes for early/solo users.
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
  if (toMemberId === memberId) {
    return NextResponse.json({ error: "cannot request yourself" }, { status: 400 });
  }

  const request = await createIntroRequest({
    from: memberId,
    to: toMemberId,
    reason: reason ?? "",
    askId: askId ?? null,
  });
  await logOutcome({
    askerId: memberId,
    targetId: toMemberId,
    askId: askId ?? null,
    action: "intro_requested",
  });

  if (target.is_synthetic) {
    await setRequestStatus(request.id, "accepted");
    await createConnection({
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
      action: "accepted",
    });
    return NextResponse.json({ accepted: true, request });
  }

  return NextResponse.json({ requested: true, request });
}
