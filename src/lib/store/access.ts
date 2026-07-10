import { nanoid } from "nanoid";
import { query, queryOne } from "./client";
import type { Application, ApplicationSnapshot } from "@/lib/types";

// ---- Waitlist ----

export interface WaitlistEntry {
  id: string;
  email: string;
  note: string;
  invited_at: string | null;
  created_at: string;
}

// Add an email to the waitlist. Idempotent on email (case-insensitive): a repeat
// signup is a no-op that still reports success, so we never leak who is on it.
export async function joinWaitlist(email: string, note = ""): Promise<void> {
  await query(
    `INSERT INTO waitlist (id, email, note) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO NOTHING`,
    [nanoid(10), email.trim(), note.trim().slice(0, 500)],
  );
}

export async function listWaitlist(limit = 500): Promise<WaitlistEntry[]> {
  return query<WaitlistEntry>(
    `SELECT id, email, note, invited_at::text AS invited_at, created_at::text AS created_at
     FROM waitlist ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
}

// ---- Invite codes ----

export interface InviteCode {
  code: string;
  note: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

// Placeholder code that always redeems, so you can walk through onboarding
// without minting a real invite. Only honored outside production (local dev) or
// in an explicit sandbox/demo environment (AMBIT_SANDBOX=1); a real production
// deploy rejects it, keeping Ambit genuinely invite-only.
const DEV_INVITE_CODE = "ambit-000000";
function isDevInvite(code: string): boolean {
  const allowed = process.env.NODE_ENV !== "production" || process.env.AMBIT_SANDBOX === "1";
  return allowed && normalizeCode(code) === DEV_INVITE_CODE;
}

// Human-friendly-ish codes: ambit-xxxxxx (no ambiguous chars). Lowercase so they
// match normalizeCode() on redemption regardless of how the user types them.
function newCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `ambit-${s}`;
}

export async function mintInviteCodes(count: number, note = ""): Promise<string[]> {
  const n = Math.max(1, Math.min(count, 200));
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const code = newCode();
    await query(
      `INSERT INTO invite_codes (code, note) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [code, note.slice(0, 200)],
    );
    codes.push(code);
  }
  return codes;
}

// True if the code exists and hasn't been spent (cheap pre-check for the UI).
export async function isInviteRedeemable(code: string): Promise<boolean> {
  if (isDevInvite(code)) return true;
  const row = await queryOne<{ code: string }>(
    `SELECT code FROM invite_codes WHERE code = $1 AND used_by IS NULL`,
    [normalizeCode(code)],
  );
  return !!row;
}

// Spend a code for a Clerk user. Compare-and-set on used_by so a code can only be
// redeemed once even under concurrent requests. Returns true if this call spent it.
// A code already redeemed BY THIS SAME user counts as success (idempotent retries).
export async function redeemInvite(code: string, clerkUserId: string): Promise<boolean> {
  if (isDevInvite(code)) return true;
  const normalized = normalizeCode(code);
  const row = await queryOne<{ code: string }>(
    `UPDATE invite_codes SET used_by = $2, used_at = now()
     WHERE code = $1 AND used_by IS NULL
     RETURNING code`,
    [normalized, clerkUserId],
  );
  if (row) return true;
  const mine = await queryOne<{ code: string }>(
    `SELECT code FROM invite_codes WHERE code = $1 AND used_by = $2`,
    [normalized, clerkUserId],
  );
  return !!mine;
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

// ---- Applications ----

const EMPTY_SNAPSHOT: ApplicationSnapshot = {
  imported: {
    headline: "",
    skills: "",
    industries: "",
    profile: "",
    contribute: "",
    work: [],
    education: [],
  },
  answers: { needs: "", meet: "", offer: "" },
};

// Rows come back with `profile` still a JSON string (it's a text column, same as
// asks.tags), so parse it into the structured snapshot here.
interface RawApplication extends Omit<Application, "profile"> {
  profile: string;
}

function parseApplication(row: RawApplication): Application {
  let profile = EMPTY_SNAPSHOT;
  try {
    const parsed = JSON.parse(row.profile) as Partial<ApplicationSnapshot>;
    profile = {
      imported: { ...EMPTY_SNAPSHOT.imported, ...(parsed.imported ?? {}) },
      answers: { ...EMPTY_SNAPSHOT.answers, ...(parsed.answers ?? {}) },
    };
  } catch {
    /* keep EMPTY_SNAPSHOT on malformed JSON */
  }
  return { ...row, profile };
}

const APP_COLS = `id, clerk_user_id, email, name, headline, profile, status,
  created_at::text AS created_at, updated_at::text AS updated_at`;

// Persist (or update) an application, keyed on the Clerk user id so re-applying
// or editing before entering a code just overwrites the snapshot. status is left
// untouched on conflict, so an already-joined member can't be knocked back to
// pending by a stray re-submit.
export async function upsertApplication(input: {
  clerkUserId: string;
  email: string;
  name: string;
  headline: string;
  profile: ApplicationSnapshot;
}): Promise<void> {
  await query(
    `INSERT INTO applications (id, clerk_user_id, email, name, headline, profile, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', now())
     ON CONFLICT (clerk_user_id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       headline = EXCLUDED.headline,
       profile = EXCLUDED.profile,
       updated_at = now()`,
    [
      nanoid(10),
      input.clerkUserId,
      input.email.trim().slice(0, 200),
      input.name.trim().slice(0, 200),
      input.headline.trim().slice(0, 200),
      JSON.stringify(input.profile),
    ],
  );
}

export async function getApplicationByClerkId(clerkUserId: string): Promise<Application | null> {
  const row = await queryOne<RawApplication>(
    `SELECT ${APP_COLS} FROM applications WHERE clerk_user_id = $1`,
    [clerkUserId],
  );
  return row ? parseApplication(row) : null;
}

export async function markApplicationJoined(clerkUserId: string): Promise<void> {
  await query(
    `UPDATE applications SET status = 'joined', updated_at = now() WHERE clerk_user_id = $1`,
    [clerkUserId],
  );
}

export async function listApplications(limit = 500): Promise<Application[]> {
  const rows = await query<RawApplication>(
    `SELECT ${APP_COLS} FROM applications ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(parseApplication);
}
