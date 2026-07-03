"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AttributeType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = { id: string; type: AttributeType; value: string };

const LABEL: Record<AttributeType, string> = {
  offer: "Can help with",
  skill: "Skills",
  experience: "Experience",
  industry: "Industries",
  interest: "Interests",
  need: "Looking for",
};
const ORDER: AttributeType[] = ["offer", "need", "skill", "experience", "industry", "interest"];

const field =
  "w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] outline-none focus:border-[var(--primary)] text-sm";

export default function PersonaEditor({
  initialName,
  initialHeadline,
  initialAttrs,
}: {
  initialName: string;
  initialHeadline: string;
  initialAttrs: Item[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [headline, setHeadline] = useState(initialHeadline);
  const [attrs, setAttrs] = useState<Item[]>(initialAttrs);
  const [drafts, setDrafts] = useState<Partial<Record<AttributeType, string>>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    setSavedProfile(false);
    const res = await fetch("/api/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "profile", name, headline }),
    });
    setSavingProfile(false);
    if (res.ok) {
      setSavedProfile(true);
      router.refresh();
    }
  }

  async function addItem(type: AttributeType) {
    const value = (drafts[type] ?? "").trim();
    if (!value) return;
    const res = await fetch("/api/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "add", type, value }),
    });
    if (res.ok) {
      const { attribute } = await res.json();
      setAttrs((a) => [...a, { id: attribute.id, type: attribute.type, value: attribute.value }]);
      setDrafts((d) => ({ ...d, [type]: "" }));
      router.refresh();
    }
  }

  async function removeItem(id: string) {
    setAttrs((a) => a.filter((x) => x.id !== id));
    await fetch("/api/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "remove", id }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 p-5">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Name
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className={`${field} mt-1.5`}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={saveProfile} disabled={savingProfile || !name.trim()}>
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
          {savedProfile && <span className="text-sm text-[var(--good)]">Saved</span>}
        </div>
      </Card>

      <Card className="p-5 gap-5">
        <h2 className="font-semibold">Your persona</h2>
        {ORDER.map((type) => (
          <div key={type}>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
              {LABEL[type]}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attrs.filter((a) => a.type === type).length === 0 && (
                <span className="text-xs text-[var(--muted-foreground)]">Nothing yet.</span>
              )}
              {attrs
                .filter((a) => a.type === type)
                .map((a) => (
                  <Badge key={a.id} variant="secondary" className="gap-1.5">
                    {a.value}
                    <button
                      onClick={() => removeItem(a.id)}
                      aria-label={`Remove ${a.value}`}
                      className="text-[var(--muted-foreground)] hover:text-[var(--accent-2)] leading-none"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                value={drafts[type] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [type]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addItem(type)}
                placeholder={`Add to ${LABEL[type].toLowerCase()}…`}
                className={`${field} flex-1`}
              />
              <Button variant="outline" size="sm" onClick={() => addItem(type)}>
                Add
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
