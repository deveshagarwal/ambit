import { NextResponse } from "next/server";
import { buildFeed } from "@/lib/feed";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// The ambient pulse. Client polls this so the organism keeps breathing.
export async function GET() {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  return NextResponse.json({ items: await buildFeed(memberId) });
}
