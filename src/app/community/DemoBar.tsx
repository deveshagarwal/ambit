"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  name: string;
  headline: string;
}

export default function DemoBar({
  options,
  currentId,
}: {
  options: Option[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function actAs(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reseed() {
    setBusy(true);
    try {
      await fetch("/api/sandbox", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 flex-row flex-wrap items-center gap-3 mb-6 bg-[var(--accent-soft)] border-[var(--primary)]/30">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
        Demo sandbox
      </span>
      <label className="text-sm flex items-center gap-2">
        Act as
        <select
          value={currentId ?? ""}
          disabled={busy}
          onChange={(e) => actAs(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm max-w-[14rem]"
        >
          <option value="" disabled>
            choose a member…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.headline.slice(0, 28)}
            </option>
          ))}
        </select>
      </label>
      <Button variant="outline" size="sm" onClick={reseed} disabled={busy} className="ml-auto">
        {busy ? "…" : "Reseed sandbox"}
      </Button>
    </Card>
  );
}
