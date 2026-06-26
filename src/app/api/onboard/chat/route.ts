import { NextResponse } from "next/server";
import { onboardTurn, type ChatMsg } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { history } = (await req.json()) as { history: ChatMsg[] };
  const reply = await onboardTurn(history ?? []);
  return NextResponse.json({ reply });
}
