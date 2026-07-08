import { NextResponse } from "next/server";
import { listAllAsks } from "@/lib/store/repo";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

// Admin-only list of every user request (ask) across the community, so the founder
// can review what people are looking for and source people for them. Guarded by the
// same ADMIN_SECRET shared secret as the invite loop (x-admin-secret header). If the
// var is unset the whole surface is closed.
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
  return NextResponse.json({ asks: await listAllAsks() });
}
