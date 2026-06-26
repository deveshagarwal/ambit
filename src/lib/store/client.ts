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

let backendPromise: Promise<Backend> | null = null;

async function makeBackend(): Promise<Backend> {
  if (CONN) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: CONN, max: 5 });
    const backend: Backend = {
      query: (text, params) => pool.query(text, params as unknown[]),
    };
    await backend.query(SCHEMA);
    return backend;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "data", "weave-pg");
  fs.mkdirSync(dir, { recursive: true });
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
  if (!backendPromise) backendPromise = makeBackend();
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
