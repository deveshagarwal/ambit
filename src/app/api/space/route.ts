import { NextResponse } from "next/server";
import { hueForMember, nearestTo, projectAll } from "@/lib/embed";
import { getMember, listMembers } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";
import { ensureSeeded } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function GET() {
  await ensureSeeded();

  const [coords, members] = await Promise.all([projectAll(), listMembers()]);
  const coordById = new Map(coords.map((c) => [c.id, c]));

  // Anonymous by design: this powers a public vector-space visual, so it exposes
  // only positions + a color, never names/headlines/identifying details.
  const points = members
    .map((m) => {
      const c = coordById.get(m.id);
      if (!c) return null;
      return {
        id: m.id,
        x: c.x,
        y: c.y,
        z: c.z,
        hue: hueForMember(m),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const body: { points: typeof points; self?: string; neighbors?: string[] } = { points };

  const selfId = await getCurrentMemberId();
  if (selfId && (await getMember(selfId))) {
    body.self = selfId;
    body.neighbors = await nearestTo(selfId, 5);
  }

  return NextResponse.json(body);
}
