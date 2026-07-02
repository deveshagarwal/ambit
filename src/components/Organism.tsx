"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Match {
  member: { id: string; name: string; headline: string; karma: number };
  score: number;
  reason: string;
  sharedTags: string[];
  attributes: { type: string; value: string }[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  matches?: Match[];
}

const GREETING =
  "I'm Ambit, the whole network speaking as one. I hold everyone here, what they can offer and what they're after. Tell me what you need, or who you could help today, and I'll find the right people.";

interface OrganismProps {
  placeholder?: string;
}

export default function Organism({ placeholder }: OrganismProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [connected, setConnected] = useState<Record<string, "sent" | "connected">>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [introError, setIntroError] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function send() {
    const q = text.trim();
    if (!q || thinking) return;

    const userMsg: Message = { role: "user", content: q };
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setThinking(true);

    try {
      const res = await fetch("/api/organism", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history }),
      });

      if (res.status === 401) {
        setNeedAuth(true);
        return;
      }
      if (!res.ok) throw new Error(`organism ${res.status}`);

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "I'm here. Tell me more.",
          matches: data.matches && data.matches.length > 0 ? data.matches : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong reaching the network. Give it another try in a moment.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function requestIntro(m: Match) {
    if (connected[m.member.id] || pending[m.member.id]) return;
    setPending((p) => ({ ...p, [m.member.id]: true }));
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toMemberId: m.member.id, reason: m.reason, askId: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConnected((c) => ({ ...c, [m.member.id]: data.accepted ? "connected" : "sent" }));
      } else if (res.status === 409) {
        // Already connected or already pending: reflect the real state.
        setConnected((c) => ({
          ...c,
          [m.member.id]: data.error === "already connected" ? "connected" : "sent",
        }));
      } else {
        setIntroError((e) => ({ ...e, [m.member.id]: "Couldn't send that. Try again." }));
      }
    } catch {
      setIntroError((e) => ({ ...e, [m.member.id]: "Couldn't send that. Try again." }));
    } finally {
      setPending((p) => ({ ...p, [m.member.id]: false }));
    }
  }

  if (needAuth) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">Build your agent persona first</h1>
        <p className="mt-2 text-[var(--muted)]">
          I need to know who you are before I can connect you to the network.
        </p>
        <Link href="/onboard" className="btn btn-primary mt-6">
          Build your persona
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 flex flex-col" style={{ height: "100%" }}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4"
        style={{ minHeight: "60vh" }}
      >
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "white" }
                    : { background: "var(--accent-soft)", color: "var(--foreground)" }
                }
              >
                {m.content}
              </div>
            </div>

            {m.matches && (
              <div className="flex flex-col gap-3">
                {m.matches.map((mt) => (
                  <div key={mt.member.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{mt.member.name}</div>
                        <div className="text-sm text-[var(--muted)]">{mt.member.headline}</div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1 rounded-md shrink-0">
                        {mt.score}% fit
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed">
                      <span className="font-medium text-[var(--accent)]">Why: </span>
                      {mt.reason}
                    </p>
                    {mt.attributes.filter((a) => a.type === "offer").length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {mt.attributes
                          .filter((a) => a.type === "offer")
                          .slice(0, 4)
                          .map((a, idx) => (
                            <span key={idx} className="tag">
                              {a.value}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="mt-4">
                      {connected[mt.member.id] === "connected" ? (
                        <span className="text-sm font-medium text-[var(--good)]">
                          Connected. You can reach out now.
                        </span>
                      ) : connected[mt.member.id] === "sent" ? (
                        <span className="text-sm font-medium text-[var(--good)]">
                          Request sent. They&apos;ll see it in their inbox.
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => requestIntro(mt)}
                            disabled={pending[mt.member.id]}
                            className="btn btn-ghost text-sm disabled:opacity-60"
                          >
                            {pending[mt.member.id] ? "Sending…" : "Request intro"}
                          </button>
                          {introError[mt.member.id] && (
                            <span className="text-xs text-[var(--accent-2)]">
                              {introError[mt.member.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-1"
              style={{ background: "var(--accent-soft)" }}
            >
              <span className="wv-dot" />
              <span className="wv-dot" style={{ animationDelay: "0.2s" }} />
              <span className="wv-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
      </div>

      <div className="card p-2 flex items-end gap-2 mt-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={placeholder ?? "Tell the network what you need..."}
          className="flex-1 resize-none px-3 py-2 bg-transparent outline-none text-sm"
        />
        <button onClick={send} disabled={thinking || !text.trim()} className="btn btn-primary">
          Send
        </button>
      </div>

      <style>{`
        .wv-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: var(--accent);
          opacity: 0.5;
          display: inline-block;
          animation: wv-bounce 1s ease-in-out infinite;
        }
        @keyframes wv-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wv-dot { animation: none; }
        }
      `}</style>
    </div>
  );
}
