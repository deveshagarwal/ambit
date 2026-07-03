import { SCHEMA } from "./schema";

// One query() layer over two backends, chosen by environment:
//  - production (DATABASE_URL / POSTGRES_URL set): node-postgres pool against a
//    hosted Postgres (Vercel Postgres / Neon).
//  - local dev (no url): PGlite, an in-process Postgres that persists to ./data.
// Both speak the same Postgres SQL, so nothing above this file knows which runs.

type Row = Record<string, unknown>;

interface Backend {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

// Which storage backend is actually live. "pglite-ephemeral" on a serverless
// host means data is per-instance and lost on redeploy — a misconfiguration.
export type DbBackend = "postgres" | "pglite-local" | "pglite-ephemeral";
let activeBackend: DbBackend = "postgres";
export function dbBackend(): DbBackend {
  return activeBackend;
}
// True on Vercel (and most serverless hosts) where the filesystem is ephemeral.
const ON_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let backendPromise: Promise<Backend> | null = null;

async function makeBackend(): Promise<Backend> {
  if (CONN) {
    activeBackend = "postgres";
    const { Pool } = await import("pg");
    // Hosted Postgres (Supabase/Neon/Vercel) requires SSL, but their pooler certs
    // don't verify against Node's default CA bundle ("self-signed certificate in
    // chain"). A connection string's sslmode=require overrides the ssl config
    // object, so force sslmode=no-verify in the string itself (SSL on, no cert
    // verification — the endpoint is a trusted managed provider).
    let conn = CONN;
    if (/[?&]sslmode=/.test(conn)) {
      conn = conn.replace(/([?&])sslmode=[^&]*/, "$1sslmode=no-verify");
    } else {
      conn += (conn.includes("?") ? "&" : "?") + "sslmode=no-verify";
    }
    const pool = new Pool({
      connectionString: conn,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
    const backend: Backend = {
      query: (text, params) => pool.query(text, params as unknown[]),
    };
    await backend.query(SCHEMA);
    return backend;
  }

  // No connection string. On a serverless host this is a real problem: the app
  // will "work" but store to a per-instance temp dir that vanishes on redeploy.
  // Log loudly so it's visible in the platform logs (and reported by /api/health).
  if (ON_SERVERLESS) {
    console.error(
      "[db] FATAL-ish: no DATABASE_URL/POSTGRES_URL set on a serverless host. " +
        "Falling back to EPHEMERAL per-instance PGlite — data will NOT persist across " +
        "deploys or instances. Attach a Postgres store and set POSTGRES_URL.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  // Prefer ./data locally (persists). On a read-only serverless filesystem
  // (e.g. Vercel without a Postgres store) fall back to the writable temp dir.
  let dir = path.join(process.cwd(), "data", "weave-pg");
  activeBackend = ON_SERVERLESS ? "pglite-ephemeral" : "pglite-local";
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    dir = path.join(os.tmpdir(), "weave-pg");
    activeBackend = "pglite-ephemeral";
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new PGlite(dir);
  const backend: Backend = {
    query: async (text, params) => {
      const res = await db.query(text, params as unknown[]);
      return { rows: res.rows as Row[] };
    },
  };
  // PGlite cannot run the whole multi-statement schema in one query() call,
  // so use exec() for the DDL bundle.
  await db.exec(SCHEMA);
  return backend;
}

function backend(): Promise<Backend> {
  // Reset on failure so a transient connect/DDL error doesn't poison the cached
  // promise permanently (next call retries instead of always rejecting).
  if (!backendPromise) {
    backendPromise = makeBackend().catch((e) => {
      backendPromise = null;
      throw e;
    });
  }
  return backendPromise;
}

export async function query<T = Row>(text: string, params?: unknown[]): Promise<T[]> {
  const b = await backend();
  const res = await b.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Row>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function exec(text: string, params?: unknown[]): Promise<void> {
  await query(text, params);
}
