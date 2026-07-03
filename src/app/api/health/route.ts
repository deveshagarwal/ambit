import { NextResponse } from "next/server";
import { dbBackend } from "@/lib/store/client";
import { queryOne } from "@/lib/store/client";

export const runtime = "nodejs";

// Public health check. Hit /api/health to confirm production is on a real,
// durable Postgres — `durable: false` means data won't survive a redeploy.
export async function GET() {
  let dbOk = false;
  let memberCount: number | null = null;
  try {
    const r = await queryOne<{ c: number }>(`SELECT COUNT(*)::int AS c FROM members`);
    memberCount = r?.c ?? 0;
    dbOk = true;
  } catch (err) {
    console.error("[health] db query failed:", err);
  }

  const backend = dbBackend();
  const durable = backend === "postgres" || backend === "pglite-local";

  return NextResponse.json(
    {
      ok: dbOk && durable,
      db: { backend, durable, ok: dbOk, memberCount },
      warning: durable
        ? undefined
        : "Ephemeral storage — data will be lost on redeploy. Attach a Postgres store and set POSTGRES_URL.",
    },
    { status: dbOk && durable ? 200 : 503 },
  );
}
