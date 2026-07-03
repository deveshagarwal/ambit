"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Sparkles, Check, ArrowRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ANALYSIS_STEPS,
  GOAL_QUESTIONS,
  SIMULATED_LINKEDIN,
  type Imported,
  type Phase,
} from "./steps";

type ChatMsg = { role: "agent" | "user"; content: string };

export default function Onboard() {
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("connect");
  const [imported, setImported] = useState<Imported | null>(null);
  // Ambit is invite-only: the code is collected up front in the Connect step and
  // spent when the persona is built. A rejected code sends the user back here.
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const name = user?.fullName ?? "there";

  return (
    <div className="min-h-screen flex flex-col">
      <StepRail phase={phase} />
      <div className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-xl">
          {phase === "connect" && (
            <Connect
              name={name}
              invite={invite}
              onInviteChange={(v) => {
                setInvite(v);
                setError(null);
              }}
              onConnected={() => {
                setError(null);
                setPhase("analyzing");
              }}
            />
          )}
          {phase === "analyzing" && (
            <Analyzing
              onDone={() => {
                setImported(SIMULATED_LINKEDIN);
                setPhase("goals");
              }}
            />
          )}
          {phase === "goals" && (
            <Goals
              name={name}
              imported={imported ?? SIMULATED_LINKEDIN}
              onComplete={async (collected) => {
                setPhase("building");
                const result = await buildPersona({
                  name: user?.fullName ?? "New member",
                  imported: imported ?? SIMULATED_LINKEDIN,
                  answers: collected,
                  inviteCode: invite,
                });
                if (result.ok) {
                  setPhase("enter");
                } else if (result.status === 403) {
                  // Bad invite code: send them back to where the code is entered.
                  setError(result.error ?? "That invite code is invalid or already used.");
                  setPhase("connect");
                } else {
                  setError(result.error ?? "Something went wrong building your profile. Try again.");
                  setPhase("goals");
                }
              }}
            />
          )}
          {phase === "building" && <Building />}
          {phase === "enter" && (
            <Enter
              name={name}
              onEnter={() => {
                router.push("/home");
                router.refresh();
              }}
            />
          )}
          {error && phase !== "building" && (
            <p className="text-sm text-[var(--accent-2)] mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
      <footer className="border-t border-border">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ambit — your network on autopilot</span>
        </div>
      </footer>
    </div>
  );
}

// Build the persona from the imported LinkedIn data + the goals interview. The
// invite code rides along: new members must spend a valid one (the API 403s
// otherwise), existing members may re-run onboarding freely.
async function buildPersona({
  name,
  imported,
  answers,
  inviteCode,
}: {
  name: string;
  imported: Imported;
  answers: Record<string, string>;
  inviteCode: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const needs = [answers.needs, answers.meet].filter(Boolean).join("\n");
  const contribute = [imported.contribute, answers.offer].filter(Boolean).join("\n");
  try {
    const res = await fetch("/api/onboard/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        headline: imported.headline,
        skills: imported.skills,
        industries: imported.industries,
        contribute,
        needs,
        inviteCode: inviteCode.trim(),
      }),
    });
    if (res.ok) return { ok: true };
    const d = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: d.error };
  } catch {
    return { ok: false, error: "Couldn't reach the network. Check your connection and try again." };
  }
}

// --- Progress rail across the top ---

const RAIL: { phase: Phase; label: string }[] = [
  { phase: "connect", label: "Connect" },
  { phase: "analyzing", label: "Analyze" },
  { phase: "goals", label: "Goals" },
  { phase: "enter", label: "Enter" },
];

function StepRail({ phase }: { phase: Phase }) {
  const order: Phase[] = ["connect", "analyzing", "goals", "building", "enter"];
  const current = order.indexOf(phase);
  return (
    <div className="w-full border-b border-border">
      <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2">
        {RAIL.map((s, i) => {
          const stepIndex = order.indexOf(s.phase);
          const done = current > stepIndex;
          const active = phase === s.phase || (phase === "building" && s.phase === "goals");
          return (
            <div key={s.phase} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`grid place-items-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span
                  className={`text-xs font-medium ${active || done ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < RAIL.length - 1 && (
                <div className={`h-px flex-1 ${done ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Step 1: invite code + connect LinkedIn (simulated) ---

function Connect({
  name,
  invite,
  onInviteChange,
  onConnected,
}: {
  name: string;
  invite: string;
  onInviteChange: (v: string) => void;
  onConnected: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  return (
    <Card className="p-8 gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-[#0a66c2] text-white text-xl font-bold mb-5">
        in
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{name !== "there" ? `, ${name.split(" ")[0]}` : ""} — let&rsquo;s build your node
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto">
        Ambit is your network on autopilot. Connect LinkedIn and your agent reads your experience,
        then goes to work finding the people who can help you.
      </p>

      <div className="mt-6 text-left">
        <label
          htmlFor="invite"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Invite code
        </label>
        <input
          id="invite"
          value={invite}
          onChange={(e) => onInviteChange(e.target.value)}
          placeholder="ambit-xxxxxx"
          className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Ambit is invite-only while the network grows. No code?{" "}
          <a href="/#waitlist" className="text-primary font-medium">
            request access
          </a>
          .
        </p>
      </div>

      <button
        onClick={() => {
          setConnecting(true);
          setTimeout(onConnected, 1100);
        }}
        disabled={connecting || !invite.trim()}
        className="mt-6 inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#0a66c2] text-white font-semibold px-5 py-3 hover:brightness-110 disabled:opacity-70 transition"
      >
        {connecting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Connecting…
          </>
        ) : (
          <>
            <span className="grid place-items-center w-5 h-5 rounded-[4px] bg-white text-[#0a66c2] text-xs font-bold">
              in
            </span>
            Connect LinkedIn
          </>
        )}
      </button>
      <p className="text-xs text-muted-foreground mt-4">
        We only read your public profile. You can edit everything later.
      </p>
    </Card>
  );
}

// --- Step 2: AI reads the profile ---

function Analyzing({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= ANALYSIS_STEPS.length) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 750);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <Card className="p-8 gap-0">
      <div className="flex items-center gap-3 mb-6">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <Sparkles className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Reading your profile</h1>
          <p className="text-sm text-muted-foreground">Building your node in the graph…</p>
        </div>
      </div>
      <ul className="space-y-3">
        {ANALYSIS_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`grid place-items-center w-5 h-5 rounded-full shrink-0 transition-colors ${
                  done
                    ? "bg-[var(--good)] text-white"
                    : active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? (
                  <Check className="w-3 h-3" />
                ) : active ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                )}
              </span>
              <span
                className={`text-sm transition-colors ${
                  done || active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// --- Step 3: chat-style goals interview ---

function Goals({
  name,
  imported,
  onComplete,
}: {
  name: string;
  imported: Imported;
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "agent", content: GOAL_QUESTIONS[0].prompt },
  ]);
  const [qIndex, setQIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const answers = useRef<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // Personalized answer chips for the current question. Start from the static
  // placeholder chips so something shows instantly, then swap in LLM suggestions
  // (best-effort — on any failure we keep the static ones).
  const question = GOAL_QUESTIONS[qIndex];
  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    setSuggestions(placeholderChips(question.placeholder));
    (async () => {
      try {
        const res = await fetch("/api/onboard/suggestions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: question.key,
            question: question.prompt,
            imported,
            answers: answers.current,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (!cancelled && data.suggestions?.length) setSuggestions(data.suggestions);
      } catch {
        /* keep the static placeholder chips */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [question, imported]);

  // Tap a chip to build up the answer (comma-separated), so multiple can stack.
  function addChip(chip: string) {
    setDraft((d) => (d.trim() ? `${d.replace(/[,\s]+$/, "")}, ${chip}` : chip));
  }

  function send() {
    const value = draft.trim();
    if (!value || typing) return;
    answers.current[GOAL_QUESTIONS[qIndex].key] = value;
    setMessages((m) => [...m, { role: "user", content: value }]);
    setDraft("");

    const next = qIndex + 1;
    if (next < GOAL_QUESTIONS.length) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setQIndex(next);
        setMessages((m) => [...m, { role: "agent", content: GOAL_QUESTIONS[next].prompt }]);
      }, 900);
    } else {
      // Final acknowledgement, then hand off to the build step.
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [
          ...m,
          { role: "agent", content: "Perfect — that's everything I need. Setting you up now…" },
        ]);
        setTimeout(() => onComplete({ ...answers.current }), 800);
      }, 900);
    }
  }

  return (
    <Card className="p-0 gap-0 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Robin</p>
          <p className="text-xs text-muted-foreground leading-tight">your Ambit agent</p>
        </div>
      </div>

      <div ref={scrollRef} className="px-5 py-5 space-y-3 h-[min(65vh,640px)] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </div>
          </div>
        )}
      </div>

      {!typing && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1">
          {suggestions
            .filter((s) => !draft.toLowerCase().includes(s.toLowerCase()))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addChip(s)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
        </div>
      )}

      <div className="border-t border-border p-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={GOAL_QUESTIONS[qIndex]?.placeholder ?? "Type your answer…"}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none max-h-28"
        />
        <Button size="icon-lg" onClick={send} disabled={!draft.trim() || typing} aria-label="Send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

// Static fallback chips derived from a question's placeholder (comma-separated
// examples). Used until the LLM suggestions arrive, or if they never do.
function placeholderChips(placeholder: string): string[] {
  return placeholder
    .replace(/[.…]+$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

// --- Building transition ---

function Building() {
  return (
    <Card className="p-10 gap-0 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      <h1 className="text-lg font-semibold tracking-tight mt-5">Building your profile</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Embedding you into the network so the right people can find you.
      </p>
    </Card>
  );
}

// --- Step 4: you're in ---

function Enter({ name, onEnter }: { name: string; onEnter: () => void }) {
  return (
    <Card className="p-8 gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-[var(--good)]/12 text-[var(--good)] mb-5">
        <Check className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        You&rsquo;re in{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto">
        Your agent is built and already at work — meeting people, spotting matches, and lining up
        the introductions worth making. The more it knows, the better they get.
      </p>

      <Button size="lg" className="mt-7 w-full h-11 text-base" onClick={onEnter}>
        Enter Ambit
        <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        Invite people who&rsquo;d be great in your network — every intro gets stronger.
      </p>
    </Card>
  );
}
