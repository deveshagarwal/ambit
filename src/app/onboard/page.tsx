"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Sparkles, Check, ArrowRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GOAL_QUESTIONS, type Imported, type Phase } from "./steps";
import { COMPANY_OPTIONS, SCHOOL_OPTIONS } from "./lists";

type ChatMsg = { role: "agent" | "user"; content: string };

export default function Onboard() {
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("invite");
  const [imported, setImported] = useState<Imported | null>(null);
  // Ambit is invite-only: the code is redeemed up front (the "invite" gate) before
  // onboarding, then re-passed to the persona build (redeemInvite is idempotent).
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const name = user?.fullName ?? "there";

  return (
    <div className="min-h-screen flex flex-col">
      {phase !== "invite" && <StepRail phase={phase} />}
      <div className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-xl">
          {phase === "invite" && (
            <InviteGate
              name={name}
              onValid={(code) => {
                setInvite(code);
                setError(null);
                setPhase("connect");
              }}
            />
          )}
          {phase === "connect" && (
            <Connect
              name={name}
              onSubmit={(profile) => {
                setImported(profile);
                setError(null);
                setPhase("goals");
              }}
            />
          )}
          {phase === "goals" && imported && (
            <Goals
              name={name}
              imported={imported}
              onComplete={async (collected) => {
                setPhase("building");
                const result = await buildPersona({
                  name: user?.fullName ?? "New member",
                  imported,
                  answers: collected,
                  inviteCode: invite,
                });
                if (result.ok) {
                  setPhase("enter");
                } else if (result.status === 403) {
                  // Invite no longer valid (rare — it was redeemed at the gate);
                  // send them back to the gate.
                  setError(result.error ?? "That invite code is invalid or already used.");
                  setPhase("invite");
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
        // The about + raw résumé text — stored on the member and mined by the LLM.
        linkedin: imported.profile,
        // Structured work/education — stored as canonical company/school/experience.
        work: imported.work,
        education: imported.education,
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
  { phase: "connect", label: "You" },
  { phase: "goals", label: "Goals" },
  { phase: "enter", label: "Done" },
];

function StepRail({ phase }: { phase: Phase }) {
  const order: Phase[] = ["connect", "goals", "building", "enter"];
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

// --- Invite gate: redeemed before onboarding begins ---

function InviteGate({ name, onValid }: { name: string; onValid: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.ok) {
        onValid(trimmed);
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "That invite code is invalid or already used.");
    } catch {
      setError("Couldn't reach the network. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="p-8 gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-5">
        <Sparkles className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto">
        Ambit is invite-only while the network grows. Enter your code to get started.
      </p>

      <input
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
        placeholder="ambit-xxxxxx"
        className="mt-6 w-full px-3.5 py-2.5 rounded-xl border border-border bg-background outline-none focus:border-primary text-center text-sm"
      />
      {error && <p className="text-sm text-[var(--accent-2)] mt-2">{error}</p>}

      <Button
        size="lg"
        className="mt-5 w-full h-11 text-base"
        disabled={!code.trim() || checking}
        onClick={submit}
      >
        {checking ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Checking…
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground mt-4">
        No code?{" "}
        <a href="/#waitlist" className="text-primary font-medium">
          Join the waitlist
        </a>
        .
      </p>
    </Card>
  );
}

// --- Step 1: upload your LinkedIn PDF / resume, confirm your profile ---

function Connect({ name, onSubmit }: { name: string; onSubmit: (profile: Imported) => void }) {
  const [headline, setHeadline] = useState("");
  const [rawText, setRawText] = useState(""); // raw extracted PDF text, mined later by buildPersona
  const [work, setWork] = useState<{ title: string; company: string; years: string }[]>([]);
  const [education, setEducation] = useState<{ school: string; degree: string }[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [about, setAbout] = useState("");
  const [upload, setUpload] = useState<
    { state: "idle" } | { state: "reading"; name: string } | { state: "done"; name: string } | { state: "error"; message: string }
  >({ state: "idle" });
  const [showHelp, setShowHelp] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUpload({ state: "reading", name: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/onboard/extract", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUpload({ state: "error", message: data.error ?? "Couldn't read that file. Try again." });
        return;
      }
      setRawText(data.text ?? "");
      // Prefill from the document, but never clobber something the user typed.
      const f = data.fields ?? {};
      if (f.headline) setHeadline((h) => h || f.headline);
      if (Array.isArray(f.work) && f.work.length) {
        setWork((w) =>
          w.length
            ? w
            : f.work.map((x: { title?: string; company?: string; years?: string }) => ({
                title: x.title ?? "",
                company: x.company ?? "",
                years: x.years ?? "",
              })),
        );
      }
      if (Array.isArray(f.education) && f.education.length) {
        setEducation((e) =>
          e.length
            ? e
            : f.education.map((x: { school?: string; degree?: string }) => ({
                school: x.school ?? "",
                degree: x.degree ?? "",
              })),
        );
      }
      if (Array.isArray(f.skills)) setSkills((s) => dedupeMerge(s, f.skills));
      if (Array.isArray(f.industries)) setIndustries((i) => dedupeMerge(i, f.industries));
      setUpload({ state: "done", name: file.name });
    } catch {
      setUpload({ state: "error", message: "Couldn't reach the network. Try again." });
    }
  }

  function submit() {
    // Work/education go through as structured rows (stored as canonical
    // company/school/experience edges). The free-text about + raw résumé is the
    // `profile` blob: stored on the member and mined by the LLM for the rest.
    const composed = [about.trim() && `About: ${about.trim()}`, rawText]
      .filter(Boolean)
      .join("\n\n");

    onSubmit({
      headline,
      skills: skills.join(", "),
      industries: industries.join(", "),
      profile: composed,
      contribute: "",
      work: work.filter((w) => w.title.trim() || w.company.trim()),
      education: education.filter((e) => e.school.trim()),
    });
  }

  const canContinue = headline.trim().length > 0 && upload.state !== "reading";
  const field =
    "mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm";

  return (
    <Card className="p-8 gap-0">
      <h1 className="text-2xl font-semibold tracking-tight text-center">
        Welcome{name !== "there" ? `, ${name.split(" ")[0]}` : ""} — tell us who you are
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto text-center">
        Upload your LinkedIn PDF and Ambit reads your real experience. The more it knows, the better
        the introductions. You can edit everything later.
      </p>

      {/* Upload zone */}
      <div className="mt-6">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your LinkedIn PDF or résumé
          </span>
          <button
            type="button"
            aria-label="Where do I get my LinkedIn PDF?"
            aria-expanded={showHelp}
            onClick={() => setShowHelp((v) => !v)}
            className="grid place-items-center w-4.5 h-4.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 text-[10px] font-semibold leading-none"
          >
            ?
          </button>
        </div>

        {showHelp && (
          <div className="mt-2 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-medium mb-1.5">Where to get your LinkedIn PDF</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open <span className="text-foreground font-medium">linkedin.com</span> and go to your own profile</li>
              <li>Click the <span className="text-foreground font-medium">Resources</span> (or <span className="text-foreground font-medium">More</span>) button under your name</li>
              <li>Choose <span className="text-foreground font-medium">Save to PDF</span> — it downloads your profile as a PDF</li>
              <li>Drop that file here (a regular résumé works too)</li>
            </ol>
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`mt-2 rounded-xl border-2 border-dashed px-5 py-7 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {upload.state === "reading" ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading {upload.name}…
            </span>
          ) : upload.state === "done" ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--good)]">
              <Check className="w-4 h-4" /> {upload.name} — got it. Review the fields below.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Drop your PDF here</span> or click to
              browse
            </span>
          )}
        </div>
        {upload.state === "error" && (
          <p className="text-sm text-[var(--accent-2)] mt-2">{upload.message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Prefer not to upload? Fill in the fields below by hand instead.
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="headline" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Headline
        </label>
        <input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Founder & CEO at Acme · ex-Stripe"
          className={field}
        />
      </div>

      {/* Work history: populated from the PDF, fully editable */}
      <EntryList
        label="Work"
        addLabel="Add role"
        entries={work}
        onChange={setWork}
        fields={[
          { key: "title", placeholder: "Title" },
          { key: "company", placeholder: "Company", kind: "combobox", options: COMPANY_OPTIONS },
          { key: "years", placeholder: "Years", kind: "years" },
        ]}
        emptyHint="Upload your PDF to fill this in, or add roles by hand."
        makeEmpty={() => ({ title: "", company: "", years: "" })}
      />

      {/* Education */}
      <EntryList
        label="Education"
        addLabel="Add school"
        entries={education}
        onChange={setEducation}
        fields={[
          { key: "school", placeholder: "School", kind: "combobox", options: SCHOOL_OPTIONS },
          { key: "degree", placeholder: "Degree (optional)" },
        ]}
        emptyHint="Optional — added automatically from your PDF when present."
        makeEmpty={() => ({ school: "", degree: "" })}
      />

      {/* Skills + industries as multi-select chips */}
      <ChipSelect
        label="Skills"
        options={SKILL_OPTIONS}
        selected={skills}
        onChange={setSkills}
        addPlaceholder="Add a skill…"
      />
      <ChipSelect
        label="Industries"
        options={INDUSTRY_OPTIONS}
        selected={industries}
        onChange={setIndustries}
        addPlaceholder="Add an industry…"
      />

      {/* Free-form, natural language */}
      <div className="mt-5">
        <label htmlFor="about" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Anything else, in your own words <span className="normal-case font-normal">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Whatever a good friend would say when introducing you — side projects, obsessions, what
          you&rsquo;re great at that a résumé misses.
        </p>
        <textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="I spent five years building marketplaces, angel-invest in climate, and host a monthly founder dinner…"
          className={`${field} resize-none`}
        />
      </div>

      <Button size="lg" className="mt-7 w-full h-11 text-base" disabled={!canContinue} onClick={submit}>
        Continue
        <ArrowRight className="w-4 h-4" />
      </Button>
    </Card>
  );
}

// Curated starting points for the chip pickers; anything extracted from the PDF
// or typed by the member is merged in as a selected custom chip.
const SKILL_OPTIONS = [
  "product management",
  "engineering",
  "design",
  "fundraising",
  "sales",
  "marketing",
  "growth",
  "machine learning",
  "data science",
  "operations",
  "recruiting",
  "finance",
  "legal",
  "content",
  "community",
  "strategy",
];

const INDUSTRY_OPTIONS = [
  "ai",
  "b2b saas",
  "fintech",
  "consumer",
  "healthcare",
  "climate",
  "developer tools",
  "ecommerce",
  "media",
  "education",
  "hardware",
  "crypto",
  "real estate",
  "gaming",
];

function dedupeMerge(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((s) => s.toLowerCase()));
  const merged = [...current];
  for (const s of incoming) {
    const v = s.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      merged.push(v);
    }
  }
  return merged.slice(0, 16);
}

// Multi-select chip picker: curated options + selected extras + free "add" input.
function ChipSelect({
  label,
  options,
  selected,
  onChange,
  addPlaceholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  addPlaceholder: string;
}) {
  const [custom, setCustom] = useState("");
  const isOn = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase());
  const toggle = (v: string) =>
    onChange(isOn(v) ? selected.filter((s) => s.toLowerCase() !== v.toLowerCase()) : [...selected, v]);
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!isOn(v)) onChange([...selected, v]);
    setCustom("");
  };
  // Selected values not in the curated list (from the PDF or typed) render first.
  const extras = selected.filter((s) => !options.some((o) => o.toLowerCase() === s.toLowerCase()));

  return (
    <div className="mt-5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} <span className="normal-case font-normal">(pick any)</span>
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...extras, ...options].map((opt) => {
          const on = isOn(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              {on ? "✓ " : ""}
              {opt}
            </button>
          );
        })}
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          onBlur={addCustom}
          placeholder={addPlaceholder}
          className="rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:border-primary w-32"
        />
      </div>
    </div>
  );
}

// Typeahead over a canonical list (companies, schools) that still allows free
// entry — normalizes the common cases for matching without blocking anyone whose
// employer/school isn't listed. Picking a suggestion stores its canonical string.
function Combobox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options)
    .filter((o) => o.toLowerCase() !== q)
    .slice(0, 8);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary text-sm"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-border bg-popover shadow-md py-1">
          {matches.map((o) => (
            <li key={o}>
              <button
                type="button"
                // onMouseDown so the pick registers before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// From/To year dropdowns backed by a single "2022 - Present" style string, so
// the PDF-extracted ranges parse straight in and downstream text stays the same.
const CURRENT_YEAR = 2026;
const YEAR_OPTIONS = Array.from({ length: 50 }, (_, i) => String(CURRENT_YEAR - i));

function parseYears(value: string): { from: string; to: string } {
  const nums = value.match(/\d{4}/g) ?? [];
  const present = /present|now|current/i.test(value);
  return { from: nums[0] ?? "", to: present ? "Present" : (nums[1] ?? "") };
}

function YearRangePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const { from, to } = parseYears(value);
  const set = (nextFrom: string, nextTo: string) => {
    if (!nextFrom && !nextTo) return onChange("");
    onChange(`${nextFrom || "?"} - ${nextTo || "?"}`);
  };
  const selectCls =
    "px-2 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary text-sm text-muted-foreground w-[5.5rem] shrink-0";
  return (
    <div className="flex items-center gap-1 shrink-0">
      <select
        value={from}
        onChange={(e) => set(e.target.value, to)}
        aria-label={`${ariaLabel} from`}
        className={selectCls}
      >
        <option value="">From</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={to}
        onChange={(e) => set(from, e.target.value)}
        aria-label={`${ariaLabel} to`}
        className={selectCls}
      >
        <option value="">To</option>
        <option value="Present">Present</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

// Editable list of structured rows (work history, education). Generic over the
// row shape so both sections share the add/edit/remove mechanics.
function EntryList<T extends Record<string, string>>({
  label,
  addLabel,
  entries,
  onChange,
  fields,
  emptyHint,
  makeEmpty,
}: {
  label: string;
  addLabel: string;
  entries: T[];
  onChange: (next: T[]) => void;
  fields: {
    key: keyof T & string;
    placeholder: string;
    narrow?: boolean;
    kind?: "text" | "years" | "combobox";
    options?: string[];
  }[];
  emptyHint: string;
  makeEmpty: () => T;
}) {
  const update = (i: number, key: keyof T & string, value: string) => {
    const next = entries.slice();
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange([...entries, makeEmpty()])}
          className="text-xs font-medium text-primary hover:underline underline-offset-4"
        >
          + {addLabel}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1.5">{emptyHint}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              {fields.map((f) =>
                f.kind === "years" ? (
                  <YearRangePicker
                    key={f.key}
                    value={entry[f.key] ?? ""}
                    onChange={(v) => update(i, f.key, v)}
                    ariaLabel={`${label} ${i + 1} years`}
                  />
                ) : f.kind === "combobox" ? (
                  <Combobox
                    key={f.key}
                    value={entry[f.key] ?? ""}
                    onChange={(v) => update(i, f.key, v)}
                    options={f.options ?? []}
                    placeholder={f.placeholder}
                    ariaLabel={`${label} ${i + 1} ${f.placeholder}`}
                  />
                ) : (
                  <input
                    key={f.key}
                    value={entry[f.key] ?? ""}
                    onChange={(e) => update(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    aria-label={`${label} ${i + 1} ${f.placeholder}`}
                    className={`px-3 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary text-sm ${
                      f.narrow ? "w-28 shrink-0" : "flex-1 min-w-0"
                    }`}
                  />
                ),
              )}
              <button
                type="button"
                aria-label={`Remove ${label.toLowerCase()} entry`}
                onClick={() => onChange(entries.filter((_, j) => j !== i))}
                className="shrink-0 grid place-items-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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
        You&rsquo;re in the network{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto">
        Your account is live and your profile is in the graph. Head to your home to make your first
        request — tell Ambit what you&rsquo;re looking for and we&rsquo;ll find the right people.
      </p>

      <Button size="lg" className="mt-7 w-full h-11 text-base" onClick={onEnter}>
        Go to your home
        <ArrowRight className="w-4 h-4" />
      </Button>
    </Card>
  );
}
