"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: id }),
    });
    router.refresh();
    setBusy(false);
  }

  async function reseed() {
    setBusy(true);
    await fetch("/api/sandbox", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="card p-4 flex flex-wrap items-center gap-3 mb-6 bg-[var(--accent-soft)] border-[var(--accent)]/30">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
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
      <button onClick={reseed} disabled={busy} className="btn btn-ghost text-sm !py-1.5 ml-auto">
        {busy ? "…" : "Reseed sandbox"}
      </button>
    </div>
  );
}
