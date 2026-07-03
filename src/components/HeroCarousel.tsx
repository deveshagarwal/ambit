"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// A fanned, auto-rotating carousel of "intro" callout cards: the kind of
// introductions Ambit makes for you. Center card is in focus; its neighbours
// fan out behind it. Pure CSS transforms + a timer — no carousel library.

interface Intro {
  name: string;
  role: string;
  // the introduction Ambit surfaces
  offer: string;
  // why it's a fit
  why: string;
  tags: string[];
  // headshot in /public/faces; falls back to initials if the file is missing
  photo?: string;
}

const INTROS: Intro[] = [
  {
    name: "Amara Okonkwo",
    role: "Founder · climate hardware",
    offer: "just raised for her carbon-capture startup and is hiring her first five",
    why: "Ex-Tesla, relentlessly focused, building something that matters — a room worth being in.",
    tags: ["founders", "climate"],
    photo: "/faces/amara.webp",
  },
  {
    name: "Sofia Reyes",
    role: "Product designer · Figma",
    offer: "is starting a tiny portfolio-crit circle",
    why: "Impeccable taste and generous with it — she'll make your work sharper.",
    tags: ["design", "crit"],
    photo: "/faces/sofia.png",
  },
  {
    name: "Marcus Bell",
    role: "Musician & producer",
    offer: "is looking for a co-writer to finish his record",
    why: "Overlapping taste, complementary skills — the collaborator your project's been missing.",
    tags: ["music", "collab"],
    photo: "/faces/marcus.png",
  },
  {
    name: "Lena Vogt",
    role: "Researcher turned writer",
    offer: "runs a salon on AI and the future of work",
    why: "Six people, big ideas, real conversation — exactly your kind of room.",
    tags: ["ideas", "salon"],
    photo: "/faces/lena.png",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

const ADVANCE_MS = 2600;

export default function HeroCarousel() {
  const n = INTROS.length;
  const [center, setCenter] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setCenter((c) => (c + 1) % n), ADVANCE_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  // Shortest signed distance from the focused card, so cards slide the short way.
  function offsetOf(i: number) {
    let off = i - center;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  }

  function styleFor(off: number): React.CSSProperties {
    const base = "translateX(-50%)";
    if (off === 0)
      return { transform: `${base} rotate(0deg) scale(1)`, opacity: 1, zIndex: 30 };
    if (off === -1)
      return {
        transform: `${base} translateX(-58%) rotate(-9deg) scale(0.84)`,
        opacity: 0.92,
        zIndex: 20,
      };
    if (off === 1)
      return {
        transform: `${base} translateX(58%) rotate(9deg) scale(0.84)`,
        opacity: 0.92,
        zIndex: 20,
      };
    // tucked behind the focus, ready to slide in
    return {
      transform: `${base} scale(0.62)`,
      opacity: 0,
      zIndex: 0,
      pointerEvents: "none",
    };
  }

  const active = INTROS[center];

  return (
    <div
      className="w-full flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* stage */}
      <div className="relative w-full max-w-5xl h-[380px] sm:h-[440px] mt-2">
        {INTROS.map((intro, i) => {
          const off = offsetOf(i);
          return (
            <button
              key={intro.name}
              onClick={() => setCenter(i)}
              aria-label={`Intro to ${intro.name}`}
              className="absolute left-1/2 top-1/2 -translate-y-1/2 w-[320px] sm:w-[380px] text-left transition-all duration-700 ease-out"
              style={styleFor(off)}
            >
              <Card className="gap-0 p-6 bg-neutral-200 text-[#18170f] shadow-[0_12px_40px_-12px_rgba(28,26,38,0.25)]">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#2563eb] font-semibold">
                  Ambit introduced you to
                </div>
                <div className="mt-4 flex items-center gap-3.5">
                  <Avatar className="size-14 shrink-0">
                    <AvatarImage src={intro.photo} alt={intro.name} />
                    <AvatarFallback className="bg-[#eef2fc] text-[#2563eb] font-bold text-base">
                      {initials(intro.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-lg leading-tight truncate">{intro.name}</div>
                    <div className="text-sm text-[#6b6962] truncate">{intro.role}</div>
                  </div>
                </div>
                <p className="mt-5 text-[15px] leading-snug">
                  <span className="font-medium">{intro.name.split(" ")[0]}</span>{" "}
                  <span className="text-[#6b6962]">{intro.offer}.</span>
                </p>
                <p className="mt-2.5 text-sm leading-snug text-[#6b6962]">{intro.why}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {intro.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* label + scrubber */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <p key={center} className="wv-rise text-base font-medium text-foreground">
          {active.name} <span className="text-muted-foreground">— {active.role}</span>
        </p>
        <div className="flex items-center gap-1.5">
          {INTROS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCenter(i)}
              aria-label={`Go to intro ${i + 1}`}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: i === center ? 26 : 10,
                background: i === center ? "#2563eb" : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
