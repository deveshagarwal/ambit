import { NextResponse } from "next/server";
import { extractProfile, type ChatMsg } from "@/lib/agent";
import { addAttributes, createMember, getMember } from "@/lib/store/repo";
import { awardJoin } from "@/lib/karma";
import { setCurrentMember } from "@/lib/session";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureSeeded();
  const { history } = (await req.json()) as { history: ChatMsg[] };
  if (!history?.length) {
    return NextResponse.json({ error: "no conversation" }, { status: 400 });
  }

  const profile = await extractProfile(history);
  const member = await createMember({
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    isSynthetic: false,
  });
  await addAttributes(
    member.id,
    profile.attributes.map((a) => ({ type: a.type, value: a.value })),
  );
  await awardJoin(member.id);
  await setCurrentMember(member.id);

  return NextResponse.json({ member: await getMember(member.id), profile });
}
