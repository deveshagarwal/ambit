"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Check,
  ArrowRight,
  Loader2,
  Copy,
  Users,
  Ticket,
  Mail,
  Inbox,
  Search,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";

// The admin surface is guarded by ADMIN_SECRET, sent as the x-admin-secret header.
// This tool unlocks with the secret, then lands on a hub with two tabs:
//   Requests — every user ask, with one-click LinkedIn sourcing via Exa
//   Invites  — the waitlist + invite-code minting flow
type Phase = "unlock" | "hub";

interface WaitlistEntry {
  id: string;
  email: string;
  note: string;
  invited_at: string | null;
  created_at: string;
}

interface AdminAsk {
  id: string;
  member_id: string;
  text: string;
  tags: string;
  status: string;
  created_at: string;
  member_name: string;
  member_headline: string;
}

interface EnrichedPerson {
  title: string;
  url: string;
  snippet: string;
  author?: string;
  reason?: string;
}

export default function AdminWizard() {
  const [phase, setPhase] = useState<Phase>("unlock");
  // Held in memory only, re-sent as the x-admin-secret header on every request.
  const [secret, setSecret] = useState("");
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-xl">
          {phase === "unlock" ? (
            <Unlock
              onUnlocked={(code, entries) => {
                setSecret(code);
                setWaitlist(entries);
                setPhase("hub");
              }}
            />
          ) : (
            <Hub secret={secret} waitlist={waitlist} />
          )}
        </div>
      </div>
      <footer className="border-t border-border">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-center gap-1.5 text-xs text-secondary">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Ambit admin — requests &amp; invites</span>
        </div>
      </footer>
    </div>
  );
}

// --- Hub: tabbed home after unlock ---

type Tab = "requests" | "invites";

function Hub({ secret, waitlist }: { secret: string; waitlist: WaitlistEntry[] }) {
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <div className="w-full">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 mb-5">
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")} icon={<Inbox className="w-4 h-4" />}>
          Requests
        </TabButton>
        <TabButton active={tab === "invites"} onClick={() => setTab("invites")} icon={<Ticket className="w-4 h-4" />}>
          Invites
        </TabButton>
      </div>
      {tab === "requests" ? <RequestsPanel secret={secret} /> : <InvitesPanel secret={secret} waitlist={waitlist} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-body text-primary shadow-sm" : "text-secondary hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// --- Requests tab: list every ask, source people from LinkedIn ---

function RequestsPanel({ secret }: { secret: string }) {
  const [asks, setAsks] = useState<AdminAsk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/requests", { headers: { "x-admin-secret": secret } });
        if (!res.ok) {
          if (!cancelled) setError("Couldn't load requests.");
          return;
        }
        const data = (await res.json()) as { asks?: AdminAsk[] };
        if (!cancelled) setAsks(data.asks ?? []);
      } catch {
        if (!cancelled) setError("Couldn't reach the network.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secret]);

  if (error) {
    return (
      <Card padding={8} className="gap-0 text-center">
        <p className="text-sm text-[var(--color-accent-2)]">{error}</p>
      </Card>
    );
  }

  if (!asks) {
    return (
      <Card padding={10} className="gap-0 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-secondary mt-4">Loading requests…</p>
      </Card>
    );
  }

  if (asks.length === 0) {
    return (
      <Card padding={10} className="gap-0 text-center">
        <Inbox className="w-6 h-6 text-secondary mx-auto" />
        <p className="text-sm text-secondary mt-4">No requests yet.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {asks.map((ask) => (
        <AskCard key={ask.id} ask={ask} secret={secret} />
      ))}
    </div>
  );
}

function AskCard({ ask, secret }: { ask: AdminAsk; secret: string }) {
  const [sourcing, setSourcing] = useState(false);
  const [people, setPeople] = useState<EnrichedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findPeople() {
    if (sourcing) return;
    setSourcing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/source", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ askText: ask.text }),
      });
      const data = (await res.json().catch(() => ({}))) as { people?: EnrichedPerson[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Search failed. Try again.");
        return;
      }
      setPeople(data.people ?? []);
    } catch {
      setError("Couldn't reach the network. Try again.");
    } finally {
      setSourcing(false);
    }
  }

  return (
    <Card padding={5} className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{ask.member_name}</p>
          {ask.member_headline && (
            <p className="text-xs text-secondary truncate">{ask.member_headline}</p>
          )}
        </div>
        <span className="shrink-0 flex items-center gap-2">
          <span className="rounded-full bg-muted text-secondary px-2 py-0.5 text-xs font-medium">
            {ask.status}
          </span>
          <span className="text-xs text-secondary">{relativeTime(ask.created_at)}</span>
        </span>
      </div>

      <p className="text-sm mt-3 leading-relaxed">{ask.text}</p>

      <div className="mt-4">
        <Button
          label={sourcing ? "Searching LinkedIn…" : people ? "Search again" : "Find people"}
          variant="ghost"
          size="lg"
          className="w-full h-10 border border-border"
          onClick={findPeople}
          isDisabled={sourcing}
          isLoading={sourcing}
          icon={sourcing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        />
      </div>

      {error && <p className="text-sm text-[var(--color-accent-2)] mt-3">{error}</p>}

      {people && (
        <div className="mt-4 flex flex-col gap-2">
          {people.length === 0 ? (
            <p className="text-sm text-secondary text-center py-4">
              No matching profiles found.
            </p>
          ) : (
            people.map((p) => <PersonRow key={p.url} person={p} />)
          )}
        </div>
      )}
    </Card>
  );
}

function PersonRow({ person }: { person: EnrichedPerson }) {
  return (
    <a
      href={person.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 hover:border-foreground/30 transition-colors"
    >
      <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-bg/10 text-accent shrink-0">
        <Sparkles className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{cleanTitle(person.title)}</p>
        {person.reason ? (
          <p className="text-xs text-secondary mt-0.5 leading-relaxed">{person.reason}</p>
        ) : (
          person.snippet && (
            <p className="text-xs text-secondary mt-0.5 leading-relaxed line-clamp-2">
              {person.snippet}
            </p>
          )
        )}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5 group-hover:text-primary" />
    </a>
  );
}

// Exa titles often carry a "| LinkedIn" suffix — trim it for a cleaner display.
function cleanTitle(title: string): string {
  return title.replace(/\s*[|\-–]\s*LinkedIn\s*$/i, "").trim() || title;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// --- Invites tab: waitlist review + mint (the original invite flow) ---

function InvitesPanel({ secret, waitlist }: { secret: string; waitlist: WaitlistEntry[] }) {
  const [view, setView] = useState<"waitlist" | "mint">("waitlist");
  return view === "waitlist" ? (
    <WaitlistReview waitlist={waitlist} onContinue={() => setView("mint")} />
  ) : (
    <MintCodes secret={secret} onBack={() => setView("waitlist")} />
  );
}

// --- Unlock with the admin secret ---

function Unlock({
  onUnlocked,
}: {
  onUnlocked: (secret: string, waitlist: WaitlistEntry[]) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    try {
      // GET doubles as the credential check — 401 means the secret is wrong.
      const res = await fetch("/api/admin/invites", {
        headers: { "x-admin-secret": trimmed },
      });
      if (res.ok) {
        const data = (await res.json()) as { waitlist?: WaitlistEntry[] };
        onUnlocked(trimmed, data.waitlist ?? []);
        return;
      }
      setError(
        res.status === 401
          ? "That admin secret is incorrect."
          : "Couldn't reach the admin surface. Try again.",
      );
    } catch {
      setError("Couldn't reach the network. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card padding={8} className="gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-accent-bg/10 text-accent mb-5">
        <ShieldCheck className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin access</h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
        Enter the admin secret to review requests, source people, and manage invites.
      </p>

      <input
        type="password"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        autoFocus
        placeholder="admin secret"
        className="mt-6 w-full px-3.5 py-2.5 rounded-xl border border-border bg-body outline-none focus:border-accent text-center text-sm"
      />
      {error && <p className="text-sm text-[var(--color-accent-2)] mt-2">{error}</p>}

      <Button
        label={checking ? "Checking…" : "Unlock"}
        variant="primary"
        size="lg"
        className="mt-5 w-full h-11 text-base"
        isDisabled={!code.trim() || checking}
        isLoading={checking}
        onClick={submit}
        icon={checking ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        endContent={checking ? undefined : <ArrowRight className="w-4 h-4" />}
      />
    </Card>
  );
}

// --- Waitlist review ---

function WaitlistReview({
  waitlist,
  onContinue,
}: {
  waitlist: WaitlistEntry[];
  onContinue: () => void;
}) {
  const pending = waitlist.filter((w) => !w.invited_at);
  return (
    <Card padding={8} className="gap-0">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-bg/10 text-accent shrink-0">
          <Users className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Waitlist</h1>
          <p className="text-sm text-secondary">
            {pending.length} waiting · {waitlist.length} total
          </p>
        </div>
      </div>

      {waitlist.length === 0 ? (
        <p className="text-sm text-secondary mt-6 text-center py-8">
          Nobody on the waitlist yet.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2 max-h-[min(50vh,480px)] overflow-y-auto">
          {waitlist.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
            >
              <Mail className="w-4 h-4 text-secondary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{w.email}</p>
                {w.note && (
                  <p className="text-xs text-secondary truncate">{w.note}</p>
                )}
              </div>
              {w.invited_at ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-good/12 text-good px-2 py-0.5 text-xs font-medium">
                  <Check className="w-3 h-3" /> invited
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-muted text-secondary px-2 py-0.5 text-xs font-medium">
                  waiting
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        label="Mint invite codes"
        variant="primary"
        size="lg"
        className="mt-7 w-full h-11 text-base"
        onClick={onContinue}
        endContent={<ArrowRight className="w-4 h-4" />}
      />
    </Card>
  );
}

// --- Mint invite codes ---

function MintCodes({ secret, onBack }: { secret: string; onBack: () => void }) {
  const [count, setCount] = useState(5);
  const [note, setNote] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function mint() {
    if (minting) return;
    setMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ count, note: note.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { codes?: string[] };
        setCodes(data.codes ?? []);
        return;
      }
      setError(
        res.status === 401
          ? "Session expired — unlock again."
          : "Couldn't mint codes. Try again.",
      );
    } catch {
      setError("Couldn't reach the network. Try again.");
    } finally {
      setMinting(false);
    }
  }

  async function copyAll() {
    if (!codes?.length) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the codes are still on screen to copy by hand */
    }
  }

  const field =
    "mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-border bg-body outline-none focus:border-accent text-sm";

  if (codes) {
    return (
      <Card padding={8} className="gap-0">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-good/12 text-good shrink-0">
            <Check className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {codes.length} code{codes.length === 1 ? "" : "s"} minted
            </h1>
            <p className="text-sm text-secondary">Hand these out — each is single-use.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm space-y-1 max-h-[min(45vh,420px)] overflow-y-auto">
          {codes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>

        <Button
          label={copied ? "Copied" : "Copy all"}
          variant="ghost"
          size="lg"
          className="mt-4 w-full h-11 border border-border"
          onClick={copyAll}
          icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        />
        <Button
          label="Mint more"
          variant="primary"
          size="lg"
          className="mt-3 w-full h-11 text-base"
          onClick={() => {
            setCodes(null);
            setNote("");
          }}
        />
      </Card>
    );
  }

  return (
    <Card padding={8} className="gap-0">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-bg/10 text-accent shrink-0">
          <Ticket className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mint invite codes</h1>
          <p className="text-sm text-secondary">Issue single-use codes to hand out.</p>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="count" className="text-xs font-semibold uppercase tracking-wide text-secondary">
          How many
        </label>
        <input
          id="count"
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          className={field}
        />
        <p className="text-xs text-secondary mt-1">1–200 codes per batch.</p>
      </div>

      <div className="mt-5">
        <label htmlFor="note" className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Note <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. YC batch, Jan launch, founder friends…"
          className={field}
        />
        <p className="text-xs text-secondary mt-1">
          Stored on each code so you remember who a batch was for.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--color-accent-2)] mt-4">{error}</p>}

      <Button
        label={minting ? "Minting…" : `Mint ${count} code${count === 1 ? "" : "s"}`}
        variant="primary"
        size="lg"
        className="mt-7 w-full h-11 text-base"
        isDisabled={minting}
        isLoading={minting}
        onClick={mint}
        icon={minting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        endContent={minting ? undefined : <ArrowRight className="w-4 h-4" />}
      />
      <button
        type="button"
        onClick={onBack}
        className="mt-3 text-xs font-medium text-secondary hover:text-primary mx-auto block"
      >
        ← Back to waitlist
      </button>
    </Card>
  );
}
