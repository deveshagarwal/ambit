import { NextResponse } from "next/server";
import { listWaitlist, mintInviteCodes } from "@/lib/store/access";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

// Simple shared-secret admin surface for running the invite loop by hand:
//   GET  -> the current waitlist (who to invite next)
//   POST { count, note } -> mint N invite codes to hand out
// Guarded by the ADMIN_SECRET env var, sent as the x-admin-secret header. If the
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
  return NextResponse.json({ waitlist: await listWaitlist() });
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureSeeded();
  const { count, note } = (await req.json().catch(() => ({}))) as {
    count?: number;
    note?: string;
  };
  const codes = await mintInviteCodes(
    typeof count === "number" ? count : 1,
    typeof note === "string" ? note : "",
  );
  return NextResponse.json({ codes });
}
