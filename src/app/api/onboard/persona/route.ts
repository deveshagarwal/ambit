import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildPersona, type PersonaInput } from "@/lib/agent";
import {
  addAttributes,
  createMember,
  getMember,
  getMemberByClerkId,
  setProfileText,
} from "@/lib/store/repo";
import type { AttributeType } from "@/lib/types";
import { redeemInvite, markApplicationJoined } from "@/lib/store/access";
import { awardJoin } from "@/lib/karma";
import { ensureSeeded } from "@/lib/bootstrap";

interface WorkRow {
  title?: string;
  company?: string;
  years?: string;
}
interface EduRow {
  school?: string;
  degree?: string;
}

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

  const body = (await req.json().catch(() => ({}))) as PersonaInput & {
    inviteCode?: string;
    work?: WorkRow[];
    education?: EduRow[];
  };
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
  const profileText = (body.linkedin ?? "").trim() || null;

  // First time: create the member linked to this Clerk account and award join
  // cred. Re-running onboarding just adds more facts to the existing member.
  if (!member) {
    member = await createMember({
      name: profile.name,
      headline: profile.headline,
      bio: profile.bio,
      isSynthetic: false,
      clerkUserId: userId,
      profileText,
    });
  } else if (profileText) {
    await setProfileText(member.id, profileText);
  }

  await addAttributes(
    member.id,
    profile.attributes.map((a) => ({ type: a.type, value: a.value, source: "persona" })),
  );

  // Structured work/education from the form -> canonical, exact-match edges, so
  // "who else worked at X / went to Y" is directly queryable for matching.
  const structured: { type: AttributeType; value: string; source: string }[] = [];
  for (const w of body.work ?? []) {
    if (w?.title?.trim()) structured.push({ type: "experience", value: w.title.trim(), source: "resume" });
    if (w?.company?.trim()) structured.push({ type: "company", value: w.company.trim(), source: "resume" });
  }
  for (const e of body.education ?? []) {
    if (e?.school?.trim()) structured.push({ type: "school", value: e.school.trim(), source: "resume" });
  }
  if (structured.length) await addAttributes(member.id, structured);

  if (isNew) {
    await awardJoin(member.id);
    // They redeemed a code and are now in the graph — retire their application.
    await markApplicationJoined(userId);
  }

  // Onboarding builds the account/persona only. The member creates their actual
  // requests later, from their home — so we don't auto-create an ask here.
  return NextResponse.json({ member: await getMember(member.id), profile });
}
