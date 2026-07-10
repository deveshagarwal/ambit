import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { suggestGoals } from "@/lib/agent";

export const runtime = "nodejs";
// Headroom over the AI client's 15s timeout so a slow draft fails into the empty
// fallback rather than getting killed by the platform first.
export const maxDuration = 30;

// Preload the goals screen with AI-drafted, editable answers. Best-effort: on any
// failure suggestGoals returns empty strings and the member just types their own.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    imported?: {
      headline?: string;
      skills?: string;
      industries?: string;
      work?: { title?: string; company?: string }[];
    };
  };
  const imported = body.imported ?? {};
  const goals = await suggestGoals({
    headline: String(imported.headline ?? ""),
    skills: String(imported.skills ?? ""),
    industries: String(imported.industries ?? ""),
    work: Array.isArray(imported.work) ? imported.work : [],
  });
  return NextResponse.json({ goals });
}
