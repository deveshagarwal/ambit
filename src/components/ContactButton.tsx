"use client";

import { useState } from "react";
import { UserPlus, Check, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

// Request to contact a (blurred) community profile. Fires an intro request; the
// person's identity is revealed once the connection is made. Signed-out visitors
// get bounced to the "sign in to connect" state.
export default function ContactButton({ memberId }: { memberId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "signin" | "error">("idle");

  async function request() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toMemberId: memberId, reason: "Reached out from the community" }),
      });
      if (res.status === 401) return setState("signin");
      // 409 = already connected / already requested — treat as sent.
      if (res.ok || res.status === 409) return setState("sent");
      setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--good)] shrink-0">
        <Check className="w-3.5 h-3.5" /> Requested
      </span>
    );
  }
  if (state === "signin") {
    return (
      <Button render={<a href="/onboard" />} variant="outline" size="sm" className="shrink-0">
        <LogIn className="w-3.5 h-3.5" /> Sign in
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={request}
      disabled={state === "sending"}
      title="Request to connect"
      aria-label="Request to connect"
      className="shrink-0"
    >
      {state === "sending" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserPlus className="w-3.5 h-3.5" />
      )}
      Connect
      {state === "error" && <span className="sr-only">error, try again</span>}
    </Button>
  );
}
