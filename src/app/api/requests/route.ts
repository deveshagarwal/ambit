import { NextResponse } from "next/server";
import { incomingRequests } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// Pending intro requests addressed to the current member.
export async function GET() {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  return NextResponse.json({ requests: await incomingRequests(memberId) });
}
