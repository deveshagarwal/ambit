"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Form {
  name: string;
  headline: string;
  linkedin: string;
  contribute: string;
  needs: string;
  skills: string;
  industries: string;
}

const EMPTY: Form = {
  name: "",
  headline: "",
  linkedin: "",
  contribute: "",
  needs: "",
  skills: "",
  industries: "",
};

export default function Onboard() {
  const router = useRouter();
  const { user } = useUser();
  const [form, setForm] = useState<Form>(EMPTY);
  const [invite, setInvite] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name from the signed-in Clerk account.
  useEffect(() => {
    const name = user?.fullName;
    if (name) setForm((f) => (f.name ? f : { ...f, name }));
  }, [user]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canBuild =
    form.name.trim().length > 0 &&
    (form.contribute.trim() || form.needs.trim()) &&
    invite.trim().length > 0;

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, inviteCode: invite.trim() }),
      });
      if (res.ok) {
        router.push("/home");
        router.refresh();
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Couldn't reach the network. Check your connection and try again.");
    } finally {
      setBuilding(false);
    }
  }

  const field =
    "w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] outline-none focus:border-[var(--primary)] text-sm";

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="mb-7">
        <div className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
          Step 1
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Mutual is the agent that connects you
        </h1>
        <p className="text-[var(--muted-foreground)] mt-2 leading-relaxed">
          Tell it more about yourself — who you are, what you can contribute, and what
          you&rsquo;re looking for. The more Mutual knows, the better the people it brings you.
        </p>
      </div>

      {/* Invite */}
      <Card className="gap-0 p-5 mb-4">
        <label
          htmlFor="invite"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
        >
          Invite code
        </label>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5 mb-3">
          Ambit is invite-only while we grow the network. Enter your code to join. No code?{" "}
          <a href="/#waitlist" className="text-[var(--primary)] font-medium">
            request access
          </a>
          .
        </p>
        <input
          id="invite"
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          placeholder="ambit-xxxxxx"
          className={field}
        />
      </Card>

      {/* Survey */}
      <Card className="p-5 gap-4">
        <h2 className="font-semibold">Tell Mutual about you</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Name *
            </label>
            <input id="name" value={form.name} onChange={set("name")} placeholder="Jordan Rivera" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label
              htmlFor="headline"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Headline
            </label>
            <input
              id="headline"
              value={form.headline}
              onChange={set("headline")}
              placeholder="Founder, B2B SaaS"
              className={`${field} mt-1.5`}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="linkedin"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Paste your LinkedIn or bio
          </label>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Optional. Copy your LinkedIn &quot;About&quot; and experience here and Mutual will pull
            out skills, experience, and industries. You can edit everything after.
          </p>
          <textarea
            id="linkedin"
            value={form.linkedin}
            onChange={set("linkedin")}
            rows={4}
            placeholder="Paste your profile text here…"
            className={`${field} resize-none mt-1.5`}
          />
        </div>

        <div>
          <label
            htmlFor="contribute"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            What can you contribute to the network?
          </label>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Intros you can make, expertise, advice, anything you can help with. One per line.
          </p>
          <textarea
            id="contribute"
            value={form.contribute}
            onChange={set("contribute")}
            rows={3}
            placeholder={"warm intros to seed VCs\npitch deck feedback\nhiring senior engineers"}
            className={`${field} resize-none mt-1.5`}
          />
        </div>

        <div>
          <label
            htmlFor="needs"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            What do you need help with right now?
          </label>
          <textarea
            id="needs"
            value={form.needs}
            onChange={set("needs")}
            rows={3}
            placeholder={"a technical co-founder\nintros to fintech recruiters\ngrowth marketing advice"}
            className={`${field} resize-none mt-1.5`}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="skills"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Skills
            </label>
            <input
              id="skills"
              value={form.skills}
              onChange={set("skills")}
              placeholder="fundraising, product, ml"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label
              htmlFor="industries"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Industries
            </label>
            <input
              id="industries"
              value={form.industries}
              onChange={set("industries")}
              placeholder="fintech, ai, consumer"
              className={`${field} mt-1.5`}
            />
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--accent-2)] mt-3">{error}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted-foreground)]">
          Mutual embeds this into the latent space so the right people can find you.
        </span>
        <Button onClick={build} disabled={!canBuild || building}>
          {building ? "Getting Mutual ready…" : "Tell Mutual about you"}
        </Button>
      </div>
    </div>
  );
}
