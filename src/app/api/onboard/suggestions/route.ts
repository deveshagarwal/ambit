import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { suggestFollowups, type FollowupInput } from "@/lib/agent";

export const runtime = "nodejs";
// Headroom over the AI client's 15s timeout so a slow suggestion call fails into
// the [] fallback rather than being killed by the platform first (matches the
// persona route's pattern).
export const maxDuration = 20;

const clamp = (v: unknown, n = 400): string =>
  typeof v === "string" ? v.slice(0, n) : "";

// Personalized, tappable answer chips for the onboarding goals interview.
// Best-effort: returns { suggestions: [] } rather than erroring so the client
// can quietly fall back to its static placeholder chips.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  let raw: Partial<FollowupInput>;
  try {
    raw = (await req.json()) as Partial<FollowupInput>;
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
  if (!raw?.key || !raw?.question || !raw?.imported) {
    return NextResponse.json({ suggestions: [] });
  }

  // The fields below are client-supplied and flow into an LLM prompt. Bound their
  // length so a signed-in user can't inflate token spend with multi-KB payloads.
  const imp = raw.imported ?? ({} as NonNullable<FollowupInput["imported"]>);
  const input: FollowupInput = {
    key: raw.key,
    question: clamp(raw.question, 300),
    imported: {
      headline: clamp(imp.headline),
      skills: clamp(imp.skills),
      industries: clamp(imp.industries),
      contribute: clamp(imp.contribute),
    },
    answers: {
      needs: clamp(raw.answers?.needs, 300) || undefined,
      meet: clamp(raw.answers?.meet, 300) || undefined,
      offer: clamp(raw.answers?.offer, 300) || undefined,
    },
  };

  const suggestions = await suggestFollowups(input);
  return NextResponse.json({ suggestions });
}
