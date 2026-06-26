"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Form {
  name: string;
  headline: string;
  contribute: string;
  needs: string;
  skills: string;
  industries: string;
}

const EMPTY: Form = {
  name: "",
  headline: "",
  contribute: "",
  needs: "",
  skills: "",
  industries: "",
};

export default function Onboard() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importState, setImportState] = useState<"idle" | "importing" | "done">("idle");

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Stub for now: real import arrives once a LinkedIn account is connected (via the
  // Vercel/Clerk auth setup). Until then this pre-fills example details to edit.
  function importLinkedIn() {
    setImportState("importing");
    setTimeout(() => {
      setForm((f) => ({
        ...f,
        name: f.name || "Jordan Rivera",
        headline: f.headline || "Founder, B2B SaaS",
        contribute:
          f.contribute || "warm intros to seed VCs\npitch deck feedback\nhiring senior engineers",
        skills: f.skills || "fundraising, product, go-to-market",
        industries: f.industries || "fintech, b2b saas",
      }));
      setImportState("done");
    }, 1100);
  }

  const canBuild = form.name.trim().length > 0 && (form.contribute.trim() || form.needs.trim());

  async function build() {
    setBuilding(true);
    setError(null);
    const res = await fetch("/api/onboard/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push("/home");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong. Try again.");
      setBuilding(false);
    }
  }

  const field =
    "w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] outline-none focus:border-[var(--accent)] text-sm";

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="mb-7">
        <div className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wide">
          Step 1
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Build your agent persona</h1>
        <p className="text-[var(--muted)] mt-2 leading-relaxed">
          Your agent represents you in the network. Teach it who you are, what you can
          contribute, and what you need. It uses this to find the right people for you,
          and to know when you can help someone else.
        </p>
      </div>

      {/* Import */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold">Import from LinkedIn</h2>
          <span className="text-xs text-[var(--muted)]">optional, speeds this up</span>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Pull in your details so your agent starts with your skills, experience, and
          industries. You can edit everything after.
        </p>
        {importState === "done" ? (
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--good)]">
            <span>✓</span> Imported from LinkedIn. Review and edit below.
          </div>
        ) : (
          <button
            onClick={importLinkedIn}
            disabled={importState === "importing"}
            className="inline-flex items-center gap-2.5 rounded-xl bg-[#0a66c2] text-white font-semibold px-4 py-2.5 hover:brightness-110 disabled:opacity-70 transition"
          >
            <span className="grid place-items-center w-5 h-5 rounded-[4px] bg-white text-[#0a66c2] text-xs font-bold">
              in
            </span>
            {importState === "importing" ? "Importing…" : "Import from LinkedIn"}
          </button>
        )}
      </div>

      {/* Survey */}
      <div className="card p-5 flex flex-col gap-4">
        <h2 className="font-semibold">Tell your agent about you</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Name *
            </label>
            <input value={form.name} onChange={set("name")} placeholder="Jordan Rivera" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Headline
            </label>
            <input
              value={form.headline}
              onChange={set("headline")}
              placeholder="Founder, B2B SaaS"
              className={`${field} mt-1.5`}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            What can you contribute to the network?
          </label>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Intros you can make, expertise, advice, anything you can help with. One per line.
          </p>
          <textarea
            value={form.contribute}
            onChange={set("contribute")}
            rows={3}
            placeholder={"warm intros to seed VCs\npitch deck feedback\nhiring senior engineers"}
            className={`${field} resize-none mt-1.5`}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            What do you need help with right now?
          </label>
          <textarea
            value={form.needs}
            onChange={set("needs")}
            rows={3}
            placeholder={"a technical co-founder\nintros to fintech recruiters\ngrowth marketing advice"}
            className={`${field} resize-none mt-1.5`}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Skills
            </label>
            <input
              value={form.skills}
              onChange={set("skills")}
              placeholder="fundraising, product, ml"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Industries
            </label>
            <input
              value={form.industries}
              onChange={set("industries")}
              placeholder="fintech, ai, consumer"
              className={`${field} mt-1.5`}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--accent-2)] mt-3">{error}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          Your agent embeds this into the latent space so the right people can find you.
        </span>
        <button onClick={build} disabled={!canBuild || building} className="btn btn-primary">
          {building ? "Training your agent…" : "Build my agent persona"}
        </button>
      </div>
    </div>
  );
}
