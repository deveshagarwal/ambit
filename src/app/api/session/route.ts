import { NextResponse } from "next/server";
import { clearCurrentMember, setCurrentMember } from "@/lib/session";
import { getMember } from "@/lib/store/repo";

export const runtime = "nodejs";

// Switch the active member (used by the demo "act as" picker).
export async function POST(req: Request) {
  const { memberId } = (await req.json()) as { memberId: string };
  if (!(await getMember(memberId))) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }
  await setCurrentMember(memberId);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearCurrentMember();
  return NextResponse.json({ ok: true });
}
