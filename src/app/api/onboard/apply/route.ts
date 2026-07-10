import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { upsertApplication } from "@/lib/store/access";
import { ensureSeeded } from "@/lib/bootstrap";
import type { ApplicationSnapshot } from "@/lib/types";

export const runtime = "nodejs";

// "Apply to join" — persist the built profile snapshot BEFORE the invite gate, so
// the founder can review applicants and mint codes for them. Keyed on the Clerk
// user (idempotent), so editing and re-applying just overwrites the snapshot.
export async function POST(req: Request) {
  await ensureSeeded();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    headline?: string;
    profile?: ApplicationSnapshot;
  };
  if (!body?.profile || typeof body.profile !== "object") {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";

  await upsertApplication({
    clerkUserId: userId,
    email,
    name: (body.name ?? user?.fullName ?? "").toString(),
    headline: (body.headline ?? "").toString(),
    profile: body.profile,
  });

  return NextResponse.json({ ok: true });
}
