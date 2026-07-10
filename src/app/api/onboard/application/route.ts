import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getApplicationByClerkId } from "@/lib/store/access";
import { getMemberByClerkId } from "@/lib/store/repo";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

// Mount-time check for /onboard: is this user already a member (→ send them home),
// and do they have a pending application to restore (→ drop them on the invite
// gate with their profile intact)?
export async function GET() {
  await ensureSeeded();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const [member, application] = await Promise.all([
    getMemberByClerkId(userId),
    getApplicationByClerkId(userId),
  ]);
  return NextResponse.json({ isMember: !!member, application });
}
