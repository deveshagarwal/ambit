import { NextResponse } from "next/server";
import { createAsk } from "@/lib/store/repo";
import { keywordTags } from "@/lib/text";
import { getCurrentMemberId } from "@/lib/session";

export const runtime = "nodejs";

// Create a request ("what you're looking for") from the member's home. Concierge
// model: we just file the request; the founder finds and makes the first matches
// manually, so this does NOT run automated matching.
export async function POST(req: Request) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const trimmed = text?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Tell us what you're looking for." }, { status: 400 });
  }
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "Keep it under 500 characters." }, { status: 400 });
  }
  const ask = await createAsk(memberId, trimmed, keywordTags(trimmed));
  return NextResponse.json({ ask });
}
