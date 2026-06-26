import { NextResponse } from "next/server";
import { seedCommunity } from "@/lib/seed";

export const runtime = "nodejs";

// Reseed the synthetic sandbox community (does not touch real members).
export async function POST() {
  const n = await seedCommunity(true);
  return NextResponse.json({ ok: true, seeded: n });
}
