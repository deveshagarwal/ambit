import { NextResponse } from "next/server";
import { listApplications } from "@/lib/store/access";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

// Who has applied to join (built a profile, awaiting an invite code). Guarded by
// ADMIN_SECRET, sent as the x-admin-secret header; closed entirely if unset.
function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureSeeded();
  return NextResponse.json({ applications: await listApplications() });
}
