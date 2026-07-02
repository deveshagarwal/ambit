import { NextResponse } from "next/server";
import { joinWaitlist } from "@/lib/store/access";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: add an email to the early-access waitlist. Idempotent per email.
export async function POST(req: Request) {
  await ensureSeeded();
  const { email, note } = (await req.json().catch(() => ({}))) as {
    email?: string;
    note?: string;
  };
  const trimmed = (email ?? "").trim();
  if (!trimmed || trimmed.length > 200 || !EMAIL.test(trimmed)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  try {
    await joinWaitlist(trimmed, typeof note === "string" ? note : "");
  } catch (err) {
    console.error("[waitlist] join failed:", err);
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
