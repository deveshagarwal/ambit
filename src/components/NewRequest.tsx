"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// The core action on home: post a request ("what you're looking for"). Concierge
// model — it files the request and confirms; the network gets back to you.
export default function NewRequest() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setText("");
        setState("done");
        router.refresh(); // show it in "Your requests"
      } else {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMessage("Couldn't reach the network. Try again.");
    }
  }

  return (
    <div>
      <label htmlFor="new-request" className="text-sm font-semibold">
        What are you looking for?
      </label>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
        A collaborator, an intro, advice, a hire — describe it and the network goes to work finding
        the right people.
      </p>
      <textarea
        id="new-request"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (state !== "idle") setState("idle");
        }}
        rows={2}
        placeholder="I'm looking for a technical co-founder in climate…"
        className="mt-2 w-full resize-none px-3.5 py-2.5 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={submit} disabled={!text.trim() || state === "sending"}>
          {state === "sending" ? "Posting…" : "Post request"}
        </Button>
        {state === "done" && (
          <span className="text-sm font-medium text-[var(--good)]">
            Request posted — we&rsquo;re on it.
          </span>
        )}
        {state === "error" && <span className="text-sm text-[var(--accent-2)]">{message}</span>}
      </div>
    </div>
  );
}
