"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Sparkles, Check, ArrowRight, Loader2, Pencil, Lock } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import {
  EMPTY_PREFILL,
  GOAL_QUESTIONS,
  type Imported,
  type Phase,
  type Prefill,
} from "./steps";
import { COMPANY_OPTIONS, SCHOOL_OPTIONS } from "./lists";
import type { ApplicationSnapshot } from "@/lib/types";

type Answers = ApplicationSnapshot["answers"];
const EMPTY_ANSWERS: Answers = { needs: "", meet: "", offer: "" };

export default function Onboard() {
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("loading");
  // Set by the upload step, consumed by the reveal step to seed its editable form.
  const [prefill, setPrefill] = useState<Prefill>(EMPTY_PREFILL);
  // The confirmed profile (after reveal) + goals — carried to apply and the gate.
  const [imported, setImported] = useState<Imported | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [error, setError] = useState<string | null>(null);

  const name = user?.fullName ?? "there";

  // On mount, ask the server where this user stands: already a member (→ home), a
  // pending applicant (→ restore their profile and jump to the invite gate), or
  // brand new (→ start at upload).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboard/application");
        if (!res.ok) {
          if (!cancelled) setPhase("upload");
          return;
        }
        const data = (await res.json()) as {
          isMember?: boolean;
          application?: { status?: string; profile?: ApplicationSnapshot } | null;
        };
        if (cancelled) return;
        if (data.isMember) {
          router.replace("/home");
          return;
        }
        const app = data.application;
        if (app && app.status === "pending" && app.profile) {
          setImported(snapshotToImported(app.profile));
          setAnswers({ ...EMPTY_ANSWERS, ...app.profile.answers });
          setPhase("waitlist");
          return;
        }
        setPhase("upload");
      } catch {
        if (!cancelled) setPhase("upload");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      {phase !== "loading" && phase !== "enter" && <StepRail phase={phase} />}
      <div className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-xl">
          {phase === "loading" && <Loading />}

          {phase === "upload" && (
            <Upload
              name={name}
              onDone={(next) => {
                setPrefill(next);
                setError(null);
                setPhase("reveal");
              }}
            />
          )}

          {phase === "reveal" && (
            <Reveal
              name={name}
              prefill={prefill}
              onContinue={(profile) => {
                setImported(profile);
                setError(null);
                setPhase("goals");
              }}
            />
          )}

          {phase === "goals" && imported && (
            <Goals
              imported={imported}
              initial={answers}
              onComplete={(collected) => {
                setAnswers(collected);
                setError(null);
                setPhase("apply");
              }}
            />
          )}

          {phase === "apply" && imported && (
            <Apply
              name={name}
              headline={imported.headline}
              onApplied={() => {
                setError(null);
                setPhase("waitlist");
              }}
              buildSnapshot={() => ({
                name: user?.fullName ?? "New member",
                headline: imported.headline,
                profile: { imported, answers },
              })}
              onError={(msg) => setError(msg)}
            />
          )}

          {phase === "waitlist" && imported && (
            <WaitlistGate
              name={name}
              onRedeem={async (code) => {
                setPhase("building");
                const result = await buildPersona({
                  name: user?.fullName ?? "New member",
                  imported,
                  answers,
                  inviteCode: code,
                });
                if (result.ok) {
                  setPhase("enter");
                  return { ok: true };
                }
                setPhase("waitlist");
                return {
                  ok: false,
                  error:
                    result.error ??
                    (result.status === 403
                      ? "That invite code is invalid or already used."
                      : "Something went wrong. Try again."),
                };
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

          {error && phase !== "building" && phase !== "loading" && (
            <p className="text-sm text-[var(--color-accent-2)] mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
      <footer className="border-t border-border">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-center gap-1.5 text-xs text-secondary">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ambit — your network on autopilot</span>
        </div>
      </footer>
    </div>
  );
}

// Rebuild the editable Imported shape from a stored application snapshot, so a
// returning applicant's profile (and the persona we later build) is unchanged.
function snapshotToImported(snap: ApplicationSnapshot): Imported {
  return {
    headline: snap.imported.headline ?? "",
    skills: snap.imported.skills ?? "",
    industries: snap.imported.industries ?? "",
    profile: snap.imported.profile ?? "",
    contribute: snap.imported.contribute ?? "",
    work: Array.isArray(snap.imported.work) ? snap.imported.work : [],
    education: Array.isArray(snap.imported.education) ? snap.imported.education : [],
  };
}

// Build the persona from the confirmed profile + goals. The invite code rides
// along: new members must spend a valid one (the API 403s otherwise), existing
// members may re-run onboarding freely.
async function buildPersona({
  name,
  imported,
  answers,
  inviteCode,
}: {
  name: string;
  imported: Imported;
  answers: Answers;
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
  { phase: "upload", label: "Profile" },
  { phase: "goals", label: "Goals" },
  { phase: "waitlist", label: "Join" },
];

// Collapse the real phase onto its rail marker: upload+reveal read as "Profile",
// goals as "Goals", and apply/waitlist/building as "Join".
function railPhaseOf(phase: Phase): Phase {
  if (phase === "reveal") return "upload";
  if (phase === "apply" || phase === "building") return "waitlist";
  return phase;
}

function StepRail({ phase }: { phase: Phase }) {
  const order: Phase[] = ["upload", "goals", "waitlist"];
  const rail = railPhaseOf(phase);
  const current = order.indexOf(rail);
  return (
    <div className="w-full border-b border-border">
      <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2">
        {RAIL.map((s, i) => {
          const stepIndex = order.indexOf(s.phase);
          const done = current > stepIndex;
          const active = rail === s.phase;
          return (
            <div key={s.phase} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`grid place-items-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? "bg-accent-bg text-on-accent"
                      : active
                        ? "bg-accent-bg/15 text-accent ring-1 ring-accent/30"
                        : "bg-muted text-secondary"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span
                  className={`text-xs font-medium ${active || done ? "text-primary" : "text-secondary"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < RAIL.length - 1 && (
                <div className={`h-px flex-1 ${done ? "bg-accent-bg/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Mount check spinner ---

function Loading() {
  return (
    <Card padding={10} className="gap-0 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      <p className="text-secondary mt-4 text-sm">Loading…</p>
    </Card>
  );
}

// --- Step 1: upload your LinkedIn PDF / resume ---
//
// A single, focused job: get the document. On a successful read we auto-advance to
// the reveal step, where Ambit's AI-structured fields are waiting pre-filled — the
// upload does the work, the member just confirms.

function Upload({ name, onDone }: { name: string; onDone: (prefill: Prefill) => void }) {
  const [upload, setUpload] = useState<
    { state: "idle" } | { state: "reading"; name: string } | { state: "error"; message: string }
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
      // Hand the AI-structured fields + raw text to the reveal step, which prefills
      // its editable form from them.
      const f = data.fields ?? {};
      onDone({
        rawText: data.text ?? "",
        headline: typeof f.headline === "string" ? f.headline : "",
        work: Array.isArray(f.work)
          ? f.work.map((x: { title?: string; company?: string; years?: string }) => ({
              title: x.title ?? "",
              company: x.company ?? "",
              years: x.years ?? "",
            }))
          : [],
        education: Array.isArray(f.education)
          ? f.education.map((x: { school?: string; degree?: string }) => ({
              school: x.school ?? "",
              degree: x.degree ?? "",
            }))
          : [],
        skills: Array.isArray(f.skills) ? dedupeMerge([], f.skills) : [],
        industries: Array.isArray(f.industries) ? dedupeMerge([], f.industries) : [],
        fromUpload: true,
        aiOk: data.aiOk !== false,
        warning: typeof data.warning === "string" ? data.warning : undefined,
      });
    } catch {
      setUpload({ state: "error", message: "Couldn't reach the network. Try again." });
    }
  }

  const reading = upload.state === "reading";

  return (
    <Card padding={8} className="gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-accent-bg/10 text-accent mb-5">
        <Sparkles className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Let&rsquo;s build your profile{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
        Upload your LinkedIn PDF or résumé and Ambit reads your real experience — then fills out the
        next screen for you. You just review and tweak.
      </p>

      <div className="mt-6 text-left">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Your LinkedIn PDF or résumé
          </span>
          <button
            type="button"
            aria-label="Where do I get my LinkedIn PDF?"
            aria-expanded={showHelp}
            onClick={() => setShowHelp((v) => !v)}
            className="grid place-items-center w-4.5 h-4.5 rounded-full border border-border text-secondary hover:text-primary hover:border-foreground/40 text-[10px] font-semibold leading-none"
          >
            ?
          </button>
        </div>

        {showHelp && (
          <div className="mt-2 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-medium mb-1.5">Where to get your LinkedIn PDF</p>
            <ol className="list-decimal list-inside space-y-1 text-secondary">
              <li>Open <span className="text-primary font-medium">linkedin.com</span> and go to your own profile</li>
              <li>Click the <span className="text-primary font-medium">Resources</span> (or <span className="text-primary font-medium">More</span>) button under your name</li>
              <li>Choose <span className="text-primary font-medium">Save to PDF</span> — it downloads your profile as a PDF</li>
              <li>Drop that file here (a regular résumé works too)</li>
            </ol>
          </div>
        )}

        <div
          role="button"
          tabIndex={reading ? -1 : 0}
          aria-disabled={reading}
          onClick={() => !reading && fileInput.current?.click()}
          onKeyDown={(e) => {
            if (!reading && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!reading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (reading) return;
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`mt-2 rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors ${
            reading
              ? "border-accent/40 bg-accent-bg/5 cursor-default"
              : dragOver
                ? "border-accent bg-accent-bg/5 cursor-pointer"
                : "border-border hover:border-accent/30 cursor-pointer"
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
          {reading ? (
            <span className="inline-flex flex-col items-center gap-2 text-sm text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span>Reading {upload.name} and filling out your profile…</span>
            </span>
          ) : (
            <span className="text-sm text-secondary">
              <span className="font-medium text-primary">Drop your PDF here</span> or click to
              browse
            </span>
          )}
        </div>
        {upload.state === "error" && (
          <p className="text-sm text-[var(--color-accent-2)] mt-2 text-center">{upload.message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDone(EMPTY_PREFILL)}
        disabled={reading}
        className="mt-5 text-xs text-secondary hover:text-primary disabled:opacity-50"
      >
        Prefer not to upload? Fill it in by hand →
      </button>
    </Card>
  );
}

// --- Step 2: reveal the built profile, edit anything ---
//
// A polished, read-only "here's what we built" card by default (styled after the
// home profile card). "Edit" flips the same state into the editable form; "Looks
// good" composes the Imported profile and advances. State is lifted here so the
// two views share a single source of truth.

function Reveal({
  name,
  prefill,
  onContinue,
}: {
  name: string;
  prefill: Prefill;
  onContinue: (profile: Imported) => void;
}) {
  const [editing, setEditing] = useState(!prefill.fromUpload);
  const [headline, setHeadline] = useState(prefill.headline);
  const [work, setWork] = useState(prefill.work);
  const [education, setEducation] = useState(prefill.education);
  const [skills, setSkills] = useState(prefill.skills);
  const [industries, setIndustries] = useState(prefill.industries);
  const [about, setAbout] = useState("");
  // Raw extracted PDF text, carried through untouched and mined later by buildPersona.
  const rawText = prefill.rawText;

  function compose(): Imported {
    // Work/education go through as structured rows (stored as canonical
    // company/school/experience edges). The free-text about + raw résumé is the
    // `profile` blob: stored on the member and mined by the LLM for the rest.
    const composed = [about.trim() && `About: ${about.trim()}`, rawText]
      .filter(Boolean)
      .join("\n\n");
    return {
      headline,
      skills: skills.join(", "),
      industries: industries.join(", "),
      profile: composed,
      contribute: "",
      work: work.filter((w) => w.title.trim() || w.company.trim()),
      education: education.filter((e) => e.school.trim()),
    };
  }

  const canContinue = headline.trim().length > 0;
  const field =
    "mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-border bg-body outline-none focus:border-accent text-sm";

  // ---- Read-only reveal ----
  if (!editing) {
    const cleanWork = work.filter((w) => w.title.trim() || w.company.trim());
    const cleanEdu = education.filter((e) => e.school.trim());
    return (
      <Card padding={8} className="gap-0">
        <div className="text-center">
          <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-accent-bg/10 text-accent mb-5">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Here&rsquo;s the profile we built</h1>
          <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
            Ambit read your background and put this together. Give it a look — you can edit anything.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {name !== "there" ? name : "You"}
              </h2>
              <p className="text-secondary text-sm">{headline || "Add a headline"}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline shrink-0 mt-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          {about.trim() && <p className="mt-3 text-sm leading-relaxed">{about.trim()}</p>}

          <div className="mt-5 flex flex-col gap-4">
            {cleanWork.length > 0 && (
              <RevealSection label="Experience">
                <div className="flex flex-col gap-1.5">
                  {cleanWork.map((w, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{w.title || w.company}</span>
                      {w.title && w.company && <span className="text-secondary"> · {w.company}</span>}
                      {w.years && <span className="text-secondary"> · {w.years}</span>}
                    </div>
                  ))}
                </div>
              </RevealSection>
            )}
            {cleanEdu.length > 0 && (
              <RevealSection label="Education">
                <div className="flex flex-col gap-1.5">
                  {cleanEdu.map((e, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{e.school}</span>
                      {e.degree && <span className="text-secondary"> · {e.degree}</span>}
                    </div>
                  ))}
                </div>
              </RevealSection>
            )}
            {skills.length > 0 && (
              <RevealSection label="Skills">
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Badge key={s} variant="neutral" label={s} />
                  ))}
                </div>
              </RevealSection>
            )}
            {industries.length > 0 && (
              <RevealSection label="Industries">
                <div className="flex flex-wrap gap-1.5">
                  {industries.map((s) => (
                    <Badge key={s} variant="neutral" label={s} />
                  ))}
                </div>
              </RevealSection>
            )}
          </div>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <Button
            label="Edit details"
            variant="ghost"
            size="lg"
            className="h-11 border border-border"
            onClick={() => setEditing(true)}
          />
          <Button
            label="Looks good"
            variant="primary"
            size="lg"
            className="flex-1 h-11 text-base"
            isDisabled={!canContinue}
            onClick={() => onContinue(compose())}
            endContent={<ArrowRight className="w-4 h-4" />}
          />
        </div>
      </Card>
    );
  }

  // ---- Editable form ----
  return (
    <Card padding={8} className="gap-0">
      <h1 className="text-2xl font-semibold tracking-tight text-center">
        {prefill.fromUpload ? "Edit your profile" : "Tell us who you are"}
      </h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto text-center">
        {prefill.fromUpload
          ? "Fix anything that's off and add a personal note. Everything here is editable."
          : "Fill in your background so Ambit can make the right introductions. You can edit everything later."}
      </p>

      {prefill.warning && (
        <div className="mt-5 rounded-xl border border-[var(--color-accent-2)]/30 bg-[var(--color-accent-2)]/5 px-3.5 py-2.5 text-sm text-primary">
          {prefill.warning}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="headline" className="text-xs font-semibold uppercase tracking-wide text-secondary">
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
        emptyHint="Add the roles that matter most."
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
        emptyHint="Optional."
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
        <label htmlFor="about" className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Anything else, in your own words <span className="normal-case font-normal">(optional)</span>
        </label>
        <p className="text-xs text-secondary mt-0.5">
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

      <div className="mt-7 flex items-center gap-3">
        {prefill.fromUpload && (
          <Button
            label="Done"
            variant="ghost"
            size="lg"
            className="h-11 border border-border"
            onClick={() => setEditing(false)}
          />
        )}
        <Button
          label="Continue"
          variant="primary"
          size="lg"
          className="flex-1 h-11 text-base"
          isDisabled={!canContinue}
          onClick={() => onContinue(compose())}
          endContent={<ArrowRight className="w-4 h-4" />}
        />
      </div>
    </Card>
  );
}

function RevealSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-secondary mb-2">{label}</div>
      {children}
    </div>
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
      <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
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
                  ? "border-accent bg-accent-bg/10 text-accent"
                  : "border-border bg-muted/40 text-primary hover:bg-muted"
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
          className="rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 text-xs outline-none focus:border-accent w-32"
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
        className="w-full px-3 py-2 rounded-lg border border-border bg-body outline-none focus:border-accent text-sm"
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
    "px-2 py-2 rounded-lg border border-border bg-body outline-none focus:border-accent text-sm text-secondary w-[5.5rem] shrink-0";
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
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
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
        <p className="text-xs text-secondary mt-1.5">{emptyHint}</p>
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
                    className={`px-3 py-2 rounded-lg border border-border bg-body outline-none focus:border-accent text-sm ${
                      f.narrow ? "w-28 shrink-0" : "flex-1 min-w-0"
                    }`}
                  />
                ),
              )}
              <button
                type="button"
                aria-label={`Remove ${label.toLowerCase()} entry`}
                onClick={() => onChange(entries.filter((_, j) => j !== i))}
                className="shrink-0 grid place-items-center w-7 h-7 rounded-lg text-secondary hover:text-primary hover:bg-muted"
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

// --- Step 3: goals screen (AI-preloaded, editable — not a chat) ---

function Goals({
  imported,
  initial,
  onComplete,
}: {
  imported: Imported;
  initial: Answers;
  onComplete: (answers: Answers) => void;
}) {
  const [values, setValues] = useState<Answers>(initial);
  // Whether we're still waiting on the AI drafts (only when nothing's prefilled yet).
  const [loading, setLoading] = useState(
    !initial.needs && !initial.meet && !initial.offer,
  );

  useEffect(() => {
    // Already have answers (e.g. edited then came back) — don't overwrite them.
    if (initial.needs || initial.meet || initial.offer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboard/goals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imported }),
        });
        if (res.ok) {
          const data = (await res.json()) as { goals?: Partial<Answers> };
          if (!cancelled && data.goals) {
            setValues((v) => ({
              needs: v.needs || data.goals?.needs || "",
              meet: v.meet || data.goals?.meet || "",
              offer: v.offer || data.goals?.offer || "",
            }));
          }
        }
      } catch {
        /* keep empty fields — the member fills them in */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = Object.values(values).some((v) => v.trim().length > 0);
  const field =
    "mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-border bg-body outline-none focus:border-accent text-sm resize-none";

  return (
    <Card padding={8} className="gap-0">
      <div className="text-center">
        <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-accent-bg/10 text-accent mb-5">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">What are your goals?</h1>
        <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
          Ambit drafted these from your profile so the right people can find you. Tweak anything —
          this is what powers your introductions.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {GOAL_QUESTIONS.map((q) => (
          <div key={q.key}>
            <label
              htmlFor={`goal-${q.key}`}
              className="text-xs font-semibold uppercase tracking-wide text-secondary"
            >
              {q.label}
            </label>
            <p className="text-xs text-secondary mt-0.5">{q.prompt}</p>
            <div className="relative">
              <textarea
                id={`goal-${q.key}`}
                value={values[q.key]}
                onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
                rows={2}
                placeholder={loading ? "Drafting…" : q.placeholder}
                className={field}
              />
              {loading && !values[q.key] && (
                <Loader2 className="w-4 h-4 animate-spin text-accent absolute right-3 top-3" />
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        label="Continue"
        variant="primary"
        size="lg"
        className="mt-7 w-full h-11 text-base"
        isDisabled={!canContinue}
        onClick={() => onComplete(values)}
        endContent={<ArrowRight className="w-4 h-4" />}
      />
    </Card>
  );
}

// --- Step 4: apply to join (persist the application, pre-invite) ---

function Apply({
  name,
  headline,
  onApplied,
  buildSnapshot,
  onError,
}: {
  name: string;
  headline: string;
  onApplied: () => void;
  buildSnapshot: () => { name: string; headline: string; profile: ApplicationSnapshot };
  onError: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function apply() {
    if (submitting) return;
    setSubmitting(true);
    onError("");
    try {
      const res = await fetch("/api/onboard/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildSnapshot()),
      });
      if (res.ok) {
        onApplied();
        return;
      }
      const d = await res.json().catch(() => ({}));
      onError(d.error ?? "Couldn't submit your application. Try again.");
    } catch {
      onError("Couldn't reach the network. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card padding={8} className="gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-accent-bg/10 text-accent mb-5">
        <Sparkles className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Ready to join Ambit{name !== "there" ? `, ${name.split(" ")[0]}` : ""}?
      </h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
        Your profile is ready{headline ? ` — ${headline}` : ""}. Ambit is invite-only while the
        network grows. Apply to join and we&rsquo;ll save your spot.
      </p>

      <Button
        label={submitting ? "Applying…" : "Apply to join"}
        variant="primary"
        size="lg"
        className="mt-7 w-full h-11 text-base"
        isDisabled={submitting}
        isLoading={submitting}
        onClick={apply}
        icon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        endContent={submitting ? undefined : <ArrowRight className="w-4 h-4" />}
      />
    </Card>
  );
}

// --- Step 5: the invite gate (now last) ---

function WaitlistGate({
  name,
  onRedeem,
}: {
  name: string;
  onRedeem: (code: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    const result = await onRedeem(trimmed);
    if (!result.ok) {
      setError(result.error ?? "That invite code is invalid or already used.");
      setChecking(false);
    }
    // On success the parent advances the phase; leave `checking` on so the button
    // stays disabled through the transition.
  }

  return (
    <Card padding={8} className="gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-good/12 text-good mb-5">
        <Check className="w-7 h-7" />
      </div>
      <p className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-secondary">
        <Lock className="w-3 h-3" />
        Invite-only &middot; private beta
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        You&rsquo;re on the list{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
        Ambit is private right now &mdash; we&rsquo;re letting people in a few at a time. We&rsquo;ll
        personally reach out by email as soon as a spot opens for you, so there&rsquo;s nothing else
        you need to do.
      </p>

      <div className="mt-7 pt-6 border-t border-border">
        <p className="text-sm text-secondary">
          Already have an invite code? Enter it to skip the line and join now.
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
          placeholder="ambit-xxxxxx"
          className="mt-3 w-full px-3.5 py-2.5 rounded-xl border border-border bg-body outline-none focus:border-accent text-center text-sm"
        />
      {error && <p className="text-sm text-[var(--color-accent-2)] mt-2">{error}</p>}

      <Button
        label={checking ? "Checking…" : "Join with invite code"}
        variant="primary"
        size="lg"
        className="mt-5 w-full h-11 text-base"
        isDisabled={!code.trim() || checking}
        isLoading={checking}
        onClick={submit}
        icon={checking ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        endContent={checking ? undefined : <ArrowRight className="w-4 h-4" />}
      />
      </div>
    </Card>
  );
}

// --- Building transition ---

function Building() {
  return (
    <Card padding={10} className="gap-0 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      <h1 className="text-lg font-semibold tracking-tight mt-5">Building your profile</h1>
      <p className="text-secondary mt-2 text-sm">
        Embedding you into the network so the right people can find you.
      </p>
    </Card>
  );
}

// --- Step 6: you're in ---

function Enter({ name, onEnter }: { name: string; onEnter: () => void }) {
  return (
    <Card padding={8} className="gap-0 text-center">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-good/12 text-good mb-5">
        <Check className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        You&rsquo;re in the network{name !== "there" ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-secondary mt-3 leading-relaxed max-w-sm mx-auto">
        Your account is live and your profile is in the graph. Head to your home to make your first
        request — tell Ambit what you&rsquo;re looking for and we&rsquo;ll find the right people.
      </p>

      <Button
        label="Go to your home"
        variant="primary"
        size="lg"
        className="mt-7 w-full h-11 text-base"
        onClick={onEnter}
        endContent={<ArrowRight className="w-4 h-4" />}
      />
    </Card>
  );
}
