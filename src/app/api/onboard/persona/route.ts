import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildPersona, type PersonaInput } from "@/lib/agent";
import { addAttributes, createMember, getMember, getMemberByClerkId } from "@/lib/store/repo";
import { awardJoin } from "@/lib/karma";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureSeeded();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const input = (await req.json()) as PersonaInput;
  if (!input?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await buildPersona(input);

  // First time: create the member linked to this Clerk account and award join
  // cred. Re-running onboarding just adds more facts to the existing member.
  let member = await getMemberByClerkId(userId);
  const isNew = !member;
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
