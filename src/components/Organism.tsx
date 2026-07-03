"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

// Shown as tappable chips on a fresh thread, to seed what you can ask the network.
const SUGGESTIONS = [
  "Introduce me to a recruiter with a strong fintech network",
  "Find a technical co-founder in my space",
  "Who can refer me into a senior PM role?",
  "Connect me with an angel who backs early climate startups",
  "I'm hiring a senior engineer — who fits?",
  "Find someone who's raised a seed round recently",
  "Who needs help with what I'm good at?",
];

interface OrganismProps {
  placeholder?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function scoreStyle(score: number): { bg: string; color: string } {
  if (score >= 90) return { bg: "#dcfce7", color: "#15803d" };
  if (score >= 75) return { bg: "#dbeafe", color: "#1d4ed8" };
  return { bg: "var(--accent-soft)", color: "var(--primary)" };
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function send(override?: string) {
    const q = (override ?? text).trim();
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
        <p className="mt-2 text-[var(--muted-foreground)]">
          I need to know who you are before I can connect you to the network.
        </p>
        <Button render={<Link href="/onboard" />} size="lg" className="mt-6">
          Build your persona
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-5 py-8 flex flex-col gap-6">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "assistant" ? (
                <div className="flex items-start gap-3">
                  <AmbitAvatar />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold tracking-widest uppercase text-[var(--primary)] mb-1.5">
                      Ambit
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: i === 0 ? "var(--muted-foreground)" : "var(--foreground)" }}
                    >
                      {m.content}
                    </p>

                    {m.matches && (
                      <div className="mt-3 flex flex-col gap-2.5">
                        {m.matches.map((mt) => {
                          const sc = scoreStyle(mt.score);
                          const state = connected[mt.member.id];
                          const offers = mt.attributes.filter((a) => a.type === "offer").slice(0, 4);
                          return (
                            <Card key={mt.member.id} className="gap-0 p-4">
                              <div className="flex items-center gap-3 mb-2.5">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                  style={{ background: "var(--accent-soft)", color: "var(--primary)" }}
                                >
                                  {initials(mt.member.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm leading-tight">
                                    {mt.member.name}
                                  </div>
                                  <div className="text-xs text-[var(--muted-foreground)] truncate">
                                    {mt.member.headline}
                                  </div>
                                </div>
                                <span
                                  className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 tabular-nums"
                                  style={{ background: sc.bg, color: sc.color }}
                                >
                                  {mt.score}%
                                </span>
                              </div>

                              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                                {mt.reason}
                              </p>

                              {offers.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1">
                                  {offers.map((a, idx) => (
                                    <Badge key={idx} variant="secondary">{a.value}</Badge>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                                {state === "connected" ? (
                                  <span className="text-xs font-semibold text-[var(--good)] flex items-center gap-1.5">
                                    <CheckIcon /> Connected — you can reach out now
                                  </span>
                                ) : state === "sent" ? (
                                  <span className="text-xs font-semibold text-[var(--good)] flex items-center gap-1.5">
                                    <CheckIcon /> Intro requested — they&apos;ll see it in their inbox
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => requestIntro(mt)}
                                      disabled={pending[mt.member.id]}
                                      className="text-xs font-semibold text-[var(--primary)] hover:underline disabled:opacity-60 disabled:no-underline"
                                    >
                                      {pending[mt.member.id] ? "Sending…" : "Request intro →"}
                                    </button>
                                    {introError[mt.member.id] && (
                                      <span className="text-xs text-[var(--accent-2)]">
                                        {introError[mt.member.id]}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div
                    className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    {m.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {messages.length === 1 && !thinking && (
            <div className="ml-11 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="secondary"
                  size="sm"
                  onClick={() => send(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          {thinking && (
            <div className="flex items-start gap-3">
              <AmbitAvatar />
              <div className="flex items-center gap-1 pt-2">
                <span className="wv-dot" />
                <span className="wv-dot" style={{ animationDelay: "0.2s" }} />
                <span className="wv-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto w-full px-5 py-4">
          <Card className="p-2 flex-row items-end gap-2">
            <textarea
              ref={textareaRef}
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
              className="flex-1 resize-none px-3 py-2 bg-transparent outline-none text-sm leading-relaxed"
              style={{ maxHeight: 140, overflowY: "auto" }}
            />
            <button
              onClick={() => send()}
              disabled={thinking || !text.trim()}
              aria-label="Send"
              className="shrink-0 w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition-all"
            >
              <SendIcon />
            </button>
          </Card>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-2 text-center select-none">
            <kbd className="font-mono">↵</kbd> to send &nbsp;·&nbsp; <kbd className="font-mono">Shift ↵</kbd> for new line
          </p>
        </div>
      </div>

      <style>{`
        .wv-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: var(--primary);
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

function AmbitAvatar() {
  return (
    <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center mt-0.5">
      <Logo size={14} className="text-white" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
