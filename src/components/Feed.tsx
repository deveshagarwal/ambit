"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

// The always-alive feed. A vertical pulse of reciprocity moments that keeps
// refreshing on its own so the network feels like a living thing you can watch
// breathe, even when you are idle.

type FeedItem = {
  id: string;
  kind: "you_can_help" | "could_help_you" | "connection" | "cred" | "joined";
  text: string;
  sub?: string;
  href?: string;
  ts: string;
};

const KIND_META: Record<
  FeedItem["kind"],
  { icon: string; color: string; label: string }
> = {
  you_can_help: { icon: "🤝", color: "var(--primary)", label: "You can help" },
  could_help_you: { icon: "✨", color: "var(--good)", label: "Help for you" },
  connection: { icon: "🪢", color: "var(--muted-foreground)", label: "Connection" },
  cred: { icon: "★", color: "var(--karma)", label: "Cred" },
  joined: { icon: "👋", color: "var(--accent-2)", label: "Joined" },
};

const POLL_MS = 20000;

function relativeTime(ts: string): string {
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.round(days / 7);
  return `${wks}w ago`;
}

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // bumped on every successful poll so relative times re-render and feel live
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to feel the pulse");
        } else {
          setError("The feed went quiet");
        }
        return;
      }
      const data = (await res.json()) as { items: FeedItem[] };
      setItems(data.items ?? []);
      setError(null);
      setTick((t) => t + 1);
    } catch {
      setError("The feed went quiet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    // re-render relative timestamps between polls so they stay honest
    const ticker = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [load]);

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--foreground)" }}>
          The pulse
        </h2>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="wv-live-dot" aria-hidden />
          Live
        </span>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-xl"
              style={{ background: "var(--accent-soft)", opacity: 0.5 }}
            />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>
          Quiet for now. The network is listening.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, i) => {
            const meta = KIND_META[item.kind];
            const highlight = item.kind === "you_can_help";
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
              >
                <span
                  className="flex items-center justify-center shrink-0 rounded-full text-sm"
                  style={{
                    width: "1.9rem",
                    height: "1.9rem",
                    background: highlight ? "var(--accent-soft)" : "transparent",
                    border: `1px solid ${meta.color}`,
                    color: meta.color,
                  }}
                  aria-hidden
                >
                  {meta.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p
                      className="text-sm font-medium leading-snug"
                      style={{ color: "var(--foreground)" }}
                    >
                      {item.text}
                    </p>
                    <span
                      className="text-[0.68rem] shrink-0 ml-auto"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {relativeTime(item.ts)}
                    </span>
                  </div>
                  {item.sub ? (
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "var(--muted-foreground)" }}
                      title={item.sub}
                    >
                      {item.sub}
                    </p>
                  ) : null}
                  {highlight && item.href ? (
                    <a
                      href={item.href}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold"
                      style={{ color: "var(--primary)" }}
                    >
                      Help out →
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <style>{`
        @keyframes wv-live {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.45; }
        }
        .wv-live-dot {
          display: inline-block;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 9999px;
          background: var(--good);
          animation: wv-live 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wv-live-dot { animation: none; }
        }
      `}</style>
    </Card>
  );
}
