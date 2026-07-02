import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildPersona, type PersonaInput } from "@/lib/agent";
import { addAttributes, createMember, getMember, getMemberByClerkId } from "@/lib/store/repo";
import { redeemInvite } from "@/lib/store/access";
import { awardJoin } from "@/lib/karma";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";
// Headroom over the AI client's 15s timeout so a slow persona build fails into
// the deterministic fallback rather than getting killed by the platform first.
export const maxDuration = 30;

export async function POST(req: Request) {
  await ensureSeeded();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as PersonaInput & { inviteCode?: string };
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Invite-only while we grow the network. Existing members can re-run onboarding
  // freely; a brand-new member must spend a valid, unused invite code first.
  let member = await getMemberByClerkId(userId);
  const isNew = !member;
  if (isNew) {
    const code = body.inviteCode?.trim();
    if (!code || !(await redeemInvite(code, userId))) {
      return NextResponse.json(
        { error: "That invite code is invalid or already used." },
        { status: 403 },
      );
    }
  }

  const profile = await buildPersona(body);

  // First time: create the member linked to this Clerk account and award join
  // cred. Re-running onboarding just adds more facts to the existing member.
  if (!member) {
    member = await createMember({
      name: profile.name,
      headline: profile.headline,
      bio: profile.bio,
      isSynthetic: false,
      clerkUserId: userId,
    });
  }

  await addAttributes(
    member.id,
    profile.attributes.map((a) => ({ type: a.type, value: a.value, source: "persona" })),
  );
  if (isNew) await awardJoin(member.id);

  return NextResponse.json({ member: await getMember(member.id), profile });
}
