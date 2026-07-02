"use client";

import { useState } from "react";

// Early-access capture. Posts to /api/waitlist and confirms in place. Kept simple
// and honest: no fake counts, clear success and error states.
export default function Waitlist({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
      } else {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMessage("Couldn't reach the network. Try again in a moment.");
    }
  }

  const inputCls = dark
    ? "flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:border-[#a99bff]"
    : "flex-1 min-w-0 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--accent)]";

  if (state === "done") {
    return (
      <p className={`text-base font-medium ${dark ? "text-white" : "text-[var(--good)]"}`}>
        You&apos;re on the list. We&apos;ll email your invite when a spot opens.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@work.com"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn btn-primary px-6 py-3 whitespace-nowrap disabled:opacity-70"
        >
          {state === "sending" ? "Joining…" : "Request access"}
        </button>
      </div>
      {state === "error" && (
        <p className={`mt-2 text-sm ${dark ? "text-[#ffb4a2]" : "text-[var(--accent-2)]"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
