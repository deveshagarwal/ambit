import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { redeemInvite } from "@/lib/store/access";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

// Redeem an invite code up front, before onboarding. redeemInvite is a
// compare-and-set bound to the Clerk user, so it claims the code for them (and
// is idempotent if they re-enter it or reach the persona build later).
export async function POST(req: Request) {
  await ensureSeeded();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const trimmed = code?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Enter your invite code." }, { status: 400 });
  }
  if (!(await redeemInvite(trimmed, userId))) {
    return NextResponse.json(
      { error: "That invite code is invalid or already used." },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
