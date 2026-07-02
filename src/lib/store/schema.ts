// Postgres schema for Ambit. The same DDL runs on PGlite (local dev) and on a
// hosted Postgres (Vercel Postgres / Neon) in production. Forward-compatible:
// facts are reified, bitemporal, confidence-scored edges; outcomes are logged
// from day one. Heavy scale pieces (pgvector, AGE) are swap-later behind the
// store interfaces, not in this schema yet.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  headline      text NOT NULL DEFAULT '',
  bio           text NOT NULL DEFAULT '',
  karma         integer NOT NULL DEFAULT 0,
  is_synthetic  boolean NOT NULL DEFAULT false,
  clerk_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Link a member to their Clerk account (idempotent for existing databases).
ALTER TABLE members ADD COLUMN IF NOT EXISTS clerk_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_clerk
  ON members(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

-- Reified, bitemporal, confidence-scored facts about a member.
-- predicate: skill | experience | industry | interest | offer | need
-- valid_from/valid_to = true-in-the-world time; observed/recorded = system time.
-- invalidate (set invalidated_at) rather than delete, so history is auditable.
CREATE TABLE IF NOT EXISTS edges (
  id            text PRIMARY KEY,
  subject_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  predicate     text NOT NULL,
  object_value  text NOT NULL,
  tag           text NOT NULL DEFAULT '',
  weight        real NOT NULL DEFAULT 1,
  confidence    real NOT NULL DEFAULT 1,
  source        text NOT NULL DEFAULT 'self',
  valid_from    timestamptz NOT NULL DEFAULT now(),
  valid_to      timestamptz,
  observed_at   timestamptz NOT NULL DEFAULT now(),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_edges_subject ON edges(subject_id);
CREATE INDEX IF NOT EXISTS idx_edges_tag ON edges(tag);
CREATE INDEX IF NOT EXISTS idx_edges_predicate ON edges(predicate);

CREATE TABLE IF NOT EXISTS asks (
  id          text PRIMARY KEY,
  member_id   text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  text        text NOT NULL,
  tags        text NOT NULL DEFAULT '[]',
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asks_member ON asks(member_id);

CREATE TABLE IF NOT EXISTS connections (
  id           text PRIMARY KEY,
  from_member  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason       text NOT NULL DEFAULT '',
  ask_id       text,
  confidence   real NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conn_from ON connections(from_member);
CREATE INDEX IF NOT EXISTS idx_conn_to ON connections(to_member);

CREATE TABLE IF NOT EXISTS karma_events (
  id             text PRIMARY KEY,
  member_id      text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  delta          integer NOT NULL,
  reason         text NOT NULL,
  related_member text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_karma_member ON karma_events(member_id);

-- Intro requests stay pending until the recipient accepts. Accepting is what
-- creates a connection and awards cred, so cred reflects real help given.
CREATE TABLE IF NOT EXISTS intro_requests (
  id           text PRIMARY KEY,
  from_member  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason       text NOT NULL DEFAULT '',
  ask_id       text,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_req_to ON intro_requests(to_member, status);
CREATE INDEX IF NOT EXISTS idx_req_from ON intro_requests(from_member);

-- The feedback loop substrate: every time the network surfaces or connects
-- people, log it. This is the labeled training data for future ranking models.
CREATE TABLE IF NOT EXISTS outcomes (
  id         text PRIMARY KEY,
  asker_id   text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  target_id  text REFERENCES members(id) ON DELETE CASCADE,
  ask_id     text,
  action     text NOT NULL,
  score      real,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_asker ON outcomes(asker_id);

-- Early-launch access control. The public landing collects emails here; real
-- members are let in with invite codes so we can grow density deliberately.
CREATE TABLE IF NOT EXISTS waitlist (
  id         text PRIMARY KEY,
  email      text NOT NULL,
  note       text NOT NULL DEFAULT '',
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(lower(email));

-- One-time invite codes. Redeeming binds the code to the redeemer's Clerk id
-- (compare-and-set on used_by, so a code can only be spent once).
CREATE TABLE IF NOT EXISTS invite_codes (
  code       text PRIMARY KEY,
  note       text NOT NULL DEFAULT '',
  used_by    text,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Note: duplicate-connection / duplicate-pending-request prevention is enforced
-- in the connect route (see api/connect), not as a unique index here, because
-- the boot-time DDL runs against the live DB with no migration guard and a
-- unique index would fail to create if legacy duplicate rows already exist.
`;
