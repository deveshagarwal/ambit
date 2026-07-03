import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { suggestFollowups, type FollowupInput } from "@/lib/agent";

export const runtime = "nodejs";

// Personalized, tappable answer chips for the onboarding goals interview.
// Best-effort: returns { suggestions: [] } rather than erroring so the client
// can quietly fall back to its static placeholder chips.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  let input: FollowupInput;
  try {
    input = (await req.json()) as FollowupInput;
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
  if (!input?.key || !input?.question || !input?.imported) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestFollowups(input);
  return NextResponse.json({ suggestions });
}
