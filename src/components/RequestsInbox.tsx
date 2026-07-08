"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";

interface Req {
  id: string;
  reason: string;
  from_name: string;
  from_headline: string;
}

// Incoming intro requests. Accepting creates the connection and earns you cred.
export default function RequestsInbox() {
  const router = useRouter();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/requests")
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => active && setReqs(d.requests ?? []))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    const res = await fetch("/api/requests/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: id, accept }),
    });
    if (res.ok) {
      setReqs((rs) => rs.filter((r) => r.id !== id));
      router.refresh(); // refresh cred/connections after accepting
    }
    setBusy(null);
  }

  if (loading || reqs.length === 0) return null;

  return (
    <Card padding={6} className="gap-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-bg" />
        <h2 className="font-semibold">Intro requests</h2>
        <span className="text-xs text-secondary">{reqs.length}</span>
      </div>
      <div className="flex flex-col gap-3">
        {reqs.map((r) => (
          <div key={r.id} className="border border-border rounded-xl p-3.5">
            <div className="font-medium text-sm">{r.from_name}</div>
            <div className="text-xs text-secondary">{r.from_headline}</div>
            {r.reason && (
              <p className="mt-1.5 text-xs text-secondary leading-relaxed">{r.reason}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                label="Accept"
                variant="primary"
                size="sm"
                onClick={() => respond(r.id, true)}
                isDisabled={busy === r.id}
              />
              <Button
                label="Decline"
                variant="ghost"
                size="sm"
                onClick={() => respond(r.id, false)}
                isDisabled={busy === r.id}
                className="border border-border"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
