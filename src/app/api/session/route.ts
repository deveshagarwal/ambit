import { NextResponse } from "next/server";
import { clearCurrentMember, sandboxEnabled, setCurrentMember } from "@/lib/session";
import { getMember } from "@/lib/store/repo";

export const runtime = "nodejs";

// Switch the active member (used by the demo "act as" picker). Only available in
// the sandbox, and only for synthetic members, so it can never impersonate a
// real account.
export async function POST(req: Request) {
  if (!sandboxEnabled()) {
    return NextResponse.json({ error: "sandbox disabled" }, { status: 403 });
  }
  const { memberId } = (await req.json().catch(() => ({}))) as { memberId?: string };
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }
  const target = await getMember(memberId);
  if (!target) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }
  if (!target.is_synthetic) {
    return NextResponse.json({ error: "can only act as a demo member" }, { status: 403 });
  }
  await setCurrentMember(memberId);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearCurrentMember();
  return NextResponse.json({ ok: true });
}
