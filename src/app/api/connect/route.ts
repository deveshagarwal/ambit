import { NextResponse } from "next/server";
import { createIntroRequest, getMember, logOutcome } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// Send an intro request. It stays pending until the recipient accepts (see
// /api/requests/respond). No connection or cred is granted yet.
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

  return NextResponse.json({ requested: true, request });
}
