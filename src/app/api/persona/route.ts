import { NextResponse } from "next/server";
import {
  addAttribute,
  invalidateEdge,
  updateMemberProfile,
} from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";
import { ATTRIBUTE_TYPES, type AttributeType } from "@/lib/types";

export const runtime = "nodejs";

// Edit your persona: add a fact, remove one, or update name/headline.
export async function POST(req: Request) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = (await req.json()) as {
    op: "add" | "remove" | "profile";
    type?: string;
    value?: string;
    id?: string;
    name?: string;
    headline?: string;
  };

  if (body.op === "add") {
    if (!body.value?.trim() || !ATTRIBUTE_TYPES.includes(body.type as AttributeType)) {
      return NextResponse.json({ error: "invalid attribute" }, { status: 400 });
    }
    const attr = await addAttribute(memberId, {
      type: body.type as AttributeType,
      value: body.value,
    });
    return NextResponse.json({ attribute: attr });
  }

  if (body.op === "remove") {
    if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    await invalidateEdge(body.id, memberId);
    return NextResponse.json({ ok: true });
  }

  if (body.op === "profile") {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await updateMemberProfile(memberId, {
      name: body.name.trim(),
      headline: (body.headline ?? "").trim(),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
