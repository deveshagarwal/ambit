import { NextResponse } from "next/server";
import {
  createConnection,
  getIntroRequest,
  logOutcome,
  setRequestStatus,
} from "@/lib/store/repo";
import { awardConnection } from "@/lib/karma";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// Accept or decline an intro request. Accepting is what creates the connection
// and awards cred (helper = the recipient who agreed, asker = the requester).
export async function POST(req: Request) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { requestId, accept } = (await req.json()) as { requestId: string; accept: boolean };

  const request = await getIntroRequest(requestId);
  if (!request) {
    return NextResponse.json({ error: "request not found" }, { status: 404 });
  }
  if (request.to_member !== memberId) {
    return NextResponse.json({ error: "not your request" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "already responded" }, { status: 409 });
  }

  // Compare-and-set: only the call that actually flips the pending request does
  // the side effects, so a double-submit can't double-award karma or connect twice.
  const flipped = await setRequestStatus(requestId, accept ? "accepted" : "declined");
  if (!flipped) {
    return NextResponse.json({ error: "already responded" }, { status: 409 });
  }

  if (accept) {
    await createConnection({
      from: request.from_member,
      to: request.to_member,
      reason: request.reason,
      askId: request.ask_id,
    });
    await awardConnection(memberId, request.from_member);
    await logOutcome({
      askerId: request.from_member,
      targetId: memberId,
      askId: request.ask_id,
      action: "accepted",
    });
  } else {
    await logOutcome({
      askerId: request.from_member,
      targetId: memberId,
      askId: request.ask_id,
      action: "declined",
    });
  }

  return NextResponse.json({ ok: true });
}
