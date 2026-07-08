"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

// A fanned, auto-rotating carousel of "intro" cards: the introductions Ambit
// makes for you. The card is the whole pitch, so each one shows three things:
//   1. WHO — an aspirational person actually worth meeting (photo-forward)
//   2. WHY YOU — communities you share (Cal, YC, …) + a note tied to what you
//      wanted, in your terms
// Center card is in focus; its neighbours fan out behind it. Pure CSS
// transforms + a timer, no carousel library.

interface Community {
  label: string;
  // one of these two renders the mark:
  slug?: string; // Simple Icons slug -> brand-coloured logo
  mono?: string; // fallback monogram badge (schools, clubs)
  bg?: string; // monogram badge background
  fg?: string; // monogram badge text
}

interface Intro {
  name: string;
  role: string;
  photo?: string;
  fit: number;
  // what they're doing / offering right now
  offer: string;
  // why Ambit connected you two, phrased against what you wanted
  note: string;
  // communities you already share
  communities: Community[];
}

const CAL = { label: "Cal", mono: "Cal", bg: "#003262", fg: "#FDB515" };
const STANFORD = { label: "Stanford", mono: "S", bg: "#8C1515", fg: "#ffffff" };
const MIT = { label: "MIT", mono: "MIT", bg: "#A31F34", fg: "#ffffff" };
const ON_DECK = { label: "On Deck", mono: "OD", bg: "#F0402B", fg: "#ffffff" };

// One card per archetype: founder, investor, elite-company operator, researcher.
// Each carries a hard proof point (raise, elite company, exit/credential).
const INTROS: Intro[] = [
  {
    name: "Amara Okonkwo",
    role: "Founder · carbon capture · ex-Tesla",
    photo: "/faces/amara.webp",
    fit: 96,
    offer: "just raised a $12M Series A led by Lowercarbon and is hiring her founding engineer",
    note: "You wanted in early at a serious climate startup — Amara's hiring a founding engineer, and your MechE-at-Cal, shipped-hardware track record is exactly her gap.",
    communities: [CAL, { label: "YC W24", slug: "ycombinator" }],
  },
  {
    name: "Marcus Chen",
    role: "Partner at First Round · ex-Stripe",
    photo: "/faces/marcus.png",
    fit: 92,
    offer: "writes first checks and opens his whole operator network to founders he backs",
    note: "You wanted to raise from someone who's actually operated — Marcus spent five years building at Stripe before First Round, and he's Stanford like you.",
    communities: [STANFORD, { label: "Stripe", slug: "stripe" }],
  },
  {
    name: "Sofia Reyes",
    role: "Founding designer at Linear · now Figma",
    photo: "/faces/sofia.png",
    fit: 90,
    offer: "advises two seed-stage teams a year on product — and just opened a slot",
    note: "You wanted your product to feel world-class — Sofia was Linear's founding designer, she's Cal like you, and she takes on almost no one.",
    communities: [CAL, { label: "Figma", slug: "figma" }],
  },
  {
    name: "Lena Vogt",
    role: "AI researcher · ex-DeepMind · 40k readers",
    photo: "/faces/lena.png",
    fit: 88,
    offer: "runs the invite-only dinners where SF's AI-and-work crowd actually meets",
    note: "You wanted into the room where AI's future gets argued — Lena was a researcher at DeepMind, and her dinners are that room. You both came through On Deck.",
    communities: [MIT, ON_DECK],
  },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function CommunityChip({ c }: { c: Community }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 ring-1 ring-black/[0.06] pl-1 pr-2.5 py-0.5 text-[12px] font-medium text-[#2a2824]">
      {c.slug ? (
        <img
          src={`https://cdn.simpleicons.org/${c.slug}`}
          alt=""
          className="size-4 rounded-[3px]"
          loading="lazy"
        />
      ) : (
        <span
          className="grid size-4 place-items-center rounded-[3px] text-[8px] font-bold leading-none"
          style={{ background: c.bg, color: c.fg }}
        >
          {c.mono}
        </span>
      )}
      {c.label}
    </span>
  );
}

const ADVANCE_MS = 3400;

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
        transform: `${base} translateX(-52%) rotate(-8deg) scale(0.86)`,
        opacity: 0.9,
        zIndex: 20,
      };
    if (off === 1)
      return {
        transform: `${base} translateX(52%) rotate(8deg) scale(0.86)`,
        opacity: 0.9,
        zIndex: 20,
      };
    return {
      transform: `${base} scale(0.64)`,
      opacity: 0,
      zIndex: 0,
      pointerEvents: "none",
    };
  }

  return (
    <div
      className="w-full flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* stage */}
      <div className="relative w-full max-w-5xl h-[440px] sm:h-[452px] mt-2">
        {INTROS.map((intro, i) => {
          const off = offsetOf(i);
          return (
            <button
              key={intro.name}
              onClick={() => setCenter(i)}
              aria-label={`Intro to ${intro.name}`}
              className="absolute left-1/2 top-1/2 -translate-y-1/2 w-[340px] sm:w-[380px] text-left transition-all duration-700 ease-out"
              style={styleFor(off)}
            >
              {/* Spotlight card: photo banner on a slightly grey tile, details
                  below so nothing overlays the face. The photo shows the whole
                  face (object-contain) over a blurred, dimmed copy of itself. */}
              <div className="rounded-2xl bg-neutral-200 text-[#18170f] ring-1 ring-black/10 shadow-[0_24px_60px_-24px_rgba(30,20,15,0.35)] overflow-hidden">
                {/* photo */}
                <div className="relative h-[184px] overflow-hidden bg-neutral-800">
                  {intro.photo ? (
                    <>
                      <img
                        src={intro.photo}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl brightness-[0.55]"
                      />
                      <img
                        src={intro.photo}
                        alt={intro.name}
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-neutral-300 text-4xl font-bold text-neutral-500">
                      {initials(intro.name)}
                    </div>
                  )}
                  {/* faint top wash so the pill + badge stay legible */}
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />

                  <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                    <Logo size={12} className="text-white" />
                    Ambit intro
                  </div>

                  <div className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-white/95 shadow">
                    <div className="text-center leading-none">
                      <div className="text-base font-bold text-primary">{intro.fit}</div>
                      <div className="text-[8px] uppercase tracking-wide text-black/55">fit</div>
                    </div>
                  </div>
                </div>

                {/* body */}
                <div className="px-5 pt-4 pb-5">
                  {/* name */}
                  <div className="font-semibold text-lg leading-tight tracking-tight truncate">
                    {intro.name}
                  </div>
                  <div className="text-[12.5px] text-[#6b6962] leading-snug truncate">
                    {intro.role}
                  </div>

                  {/* shared communities */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#8a887f] font-semibold">
                      In common
                    </span>
                    {intro.communities.map((c) => (
                      <CommunityChip key={c.label} c={c} />
                    ))}
                  </div>

                  {/* offer */}
                  <p className="mt-3 text-[14px] leading-snug">
                    <span className="font-semibold">{intro.name.split(" ")[0]}</span>{" "}
                    <span className="text-[#6b6962]">{intro.offer}.</span>
                  </p>

                  {/* why you two — the note is written against what you wanted */}
                  <div className="mt-3 rounded-xl bg-white/60 border-l-2 border-accent px-3.5 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-primary font-semibold">
                      Why you two
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#3a3833]">
                      {intro.note}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* scrubber */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          {INTROS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCenter(i)}
              aria-label={`Go to intro ${i + 1}`}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: i === center ? 26 : 10,
                background:
                  i === center
                    ? "var(--color-accent)"
                    : "color-mix(in oklab, var(--color-text-primary) 20%, transparent)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
