import { NextResponse } from "next/server";
import { buildPersona, type PersonaInput } from "@/lib/agent";
import { addAttributes, createMember, getMember } from "@/lib/store/repo";
import { awardJoin } from "@/lib/karma";
import { setCurrentMember } from "@/lib/session";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureSeeded();
  const input = (await req.json()) as PersonaInput;
  if (!input?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await buildPersona(input);
  const member = await createMember({
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    isSynthetic: false,
  });
  await addAttributes(
    member.id,
    profile.attributes.map((a) => ({ type: a.type, value: a.value, source: "persona" })),
  );
  await awardJoin(member.id);
  await setCurrentMember(member.id);

  return NextResponse.json({ member: await getMember(member.id), profile });
}
