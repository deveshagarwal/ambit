import { NextResponse } from "next/server";
import { seedCommunity } from "@/lib/seed";
import { sandboxEnabled } from "@/lib/session";

export const runtime = "nodejs";

// Reseed the synthetic sandbox community. Destructive (deletes + recreates
// synthetic members), so it is only reachable when the sandbox is enabled.
export async function POST() {
  if (!sandboxEnabled()) {
    return NextResponse.json({ error: "sandbox disabled" }, { status: 403 });
  }
  const n = await seedCommunity(true);
  return NextResponse.json({ ok: true, seeded: n });
}
