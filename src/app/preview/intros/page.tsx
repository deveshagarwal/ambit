"use client";

// PREVIEW GALLERY — four redesigns of the "Ambit introduced you to" intro card.
// This is the whole pitch of the product, so it should feel like a warm, high-
// signal introduction from someone you trust — not a generic profile tile.
//
// Standalone route (no Clerk imports) so it renders in the sandbox preview.
// Pick a winner and I'll wire it into HeroCarousel. Visit /preview/intros.

import Logo from "@/components/Logo";

interface Intro {
  name: string;
  role: string;
  offer: string; // what Ambit is surfacing about them
  why: string; // why it's a fit for you
  tags: string[];
  photo: string;
  fit: number; // match confidence, 0–100
}

const AMARA: Intro = {
  name: "Amara Okonkwo",
  role: "Founder · climate hardware",
  offer: "just raised for her carbon-capture startup and is hiring her first five engineers",
  why: "Ex-Tesla, relentlessly focused, building something that matters. She needs the exact systems background you have — and you've been looking for a founding team worth betting on.",
  tags: ["founders", "climate", "hiring"],
  photo: "/faces/amara.webp",
  fit: 94,
};

const SOFIA: Intro = {
  name: "Sofia Reyes",
  role: "Product designer · Figma",
  offer: "is starting a tiny, invite-only portfolio-crit circle",
  why: "Impeccable taste and generous with it. Six people, real feedback — she'll make your work sharper.",
  tags: ["design", "crit"],
  photo: "/faces/sofia.png",
  fit: 88,
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function first(name: string) {
  return name.split(" ")[0];
}

// ---------------------------------------------------------------------------
// OPTION A — Editorial. Warm white card, terracotta eyebrow, the intro as a
// serif headline, a "why" reasoning block, and a real Connect affordance.
// ---------------------------------------------------------------------------
function OptionEditorial({ intro }: { intro: Intro }) {
  return (
    <div className="w-[380px] rounded-2xl bg-card ring-1 ring-foreground/10 shadow-[0_24px_60px_-24px_rgba(30,20,15,0.35)] overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-primary font-semibold">
          <Logo size={13} className="text-primary" />
          Ambit introduced you to
        </div>

        <div className="mt-5 flex items-center gap-4">
          <img
            src={intro.photo}
            alt={intro.name}
            className="size-16 rounded-full object-cover ring-2 ring-primary/15"
          />
          <div className="min-w-0">
            <div className="font-semibold text-xl leading-tight tracking-tight">{intro.name}</div>
            <div className="text-sm text-muted-foreground">{intro.role}</div>
          </div>
        </div>

        <p className="mt-6 text-[17px] leading-snug tracking-tight">
          <span className="font-semibold">{first(intro.name)}</span>{" "}
          <span className="text-foreground/70">{intro.offer}.</span>
        </p>

        <div className="mt-4 rounded-xl bg-secondary/70 border-l-2 border-primary px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Why you two
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-foreground/75">{intro.why}</p>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {intro.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button className="w-full border-t border-border bg-primary/[0.04] py-3.5 text-sm font-semibold text-primary hover:bg-primary/[0.08] transition-colors">
        Ask {first(intro.name)} for an intro →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OPTION B — Note from your agent. Feels like Ambit personally wrote you. A
// conversational message with the person embedded as a rich chip.
// ---------------------------------------------------------------------------
function OptionAgentNote({ intro }: { intro: Intro }) {
  return (
    <div className="w-[380px] rounded-2xl bg-card ring-1 ring-foreground/10 shadow-[0_24px_60px_-24px_rgba(30,20,15,0.35)] p-6">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
          <Logo size={16} className="text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Ambit</div>
          <div className="text-[11px] text-muted-foreground">found someone for you</div>
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">now</div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-foreground/90">
        I think you should meet{" "}
        <span className="font-semibold text-foreground">{first(intro.name)}</span>. She {intro.offer} —
        and it lines up with exactly what you&apos;re after.
      </p>

      <div className="mt-4 flex items-center gap-3.5 rounded-xl bg-secondary/60 ring-1 ring-border p-3.5">
        <img
          src={intro.photo}
          alt={intro.name}
          className="size-12 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight truncate">{intro.name}</div>
          <div className="text-[13px] text-muted-foreground truncate">{intro.role}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary leading-none">{intro.fit}%</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">fit</div>
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-snug text-muted-foreground">{intro.why}</p>

      <div className="mt-5 flex gap-2">
        <button className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          Introduce us
        </button>
        <button className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
          Not now
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OPTION C — Photo-forward spotlight. Cinematic: full-bleed portrait, name
// over a gradient, fit ring, reasoning below. Highest-impact, most premium.
// ---------------------------------------------------------------------------
function OptionSpotlight({ intro }: { intro: Intro }) {
  return (
    <div className="w-[380px] rounded-2xl bg-card ring-1 ring-foreground/10 shadow-[0_24px_60px_-24px_rgba(30,20,15,0.4)] overflow-hidden">
      <div className="relative h-56">
        <img src={intro.photo} alt={intro.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
          <Logo size={12} className="text-white" />
          Ambit intro
        </div>

        <div className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-white/95 shadow">
          <div className="text-center leading-none">
            <div className="text-base font-bold text-primary">{intro.fit}</div>
            <div className="text-[8px] uppercase tracking-wide text-foreground/60">fit</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-5 right-5 text-white">
          <div className="text-2xl font-semibold tracking-tight leading-none">{intro.name}</div>
          <div className="mt-1 text-sm text-white/80">{intro.role}</div>
        </div>
      </div>

      <div className="p-5">
        <p className="text-[15px] leading-snug tracking-tight">
          <span className="font-semibold">{first(intro.name)}</span>{" "}
          <span className="text-foreground/70">{intro.offer}.</span>
        </p>
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{intro.why}</p>
        <button className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          Ask for the intro →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OPTION D — Split. Portrait rail on the left with a terracotta wash, the
// intro + reason on the right. Compact, magazine-like.
// ---------------------------------------------------------------------------
function OptionSplit({ intro }: { intro: Intro }) {
  return (
    <div className="w-[420px] rounded-2xl bg-card ring-1 ring-foreground/10 shadow-[0_24px_60px_-24px_rgba(30,20,15,0.35)] overflow-hidden flex">
      <div className="relative w-36 shrink-0">
        <img src={intro.photo} alt={intro.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent mix-blend-multiply" />
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-primary">
          {intro.fit}% fit
        </div>
      </div>

      <div className="min-w-0 flex-1 p-5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
          <Logo size={12} className="text-primary" />
          Ambit introduced you to
        </div>
        <div className="mt-2.5 font-semibold text-lg leading-tight tracking-tight">{intro.name}</div>
        <div className="text-[13px] text-muted-foreground">{intro.role}</div>

        <p className="mt-3 text-[14px] leading-snug">
          <span className="text-foreground/70">{first(intro.name)} {intro.offer}.</span>
        </p>
        <p className="mt-2.5 text-[12.5px] leading-snug text-muted-foreground">{intro.why}</p>

        <button className="mt-4 text-sm font-semibold text-primary hover:underline underline-offset-4">
          Ask {first(intro.name)} for an intro →
        </button>
      </div>
    </div>
  );
}

function Frame({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground max-w-[300px]">{desc}</div>
      </div>
      <div className="flex items-start justify-center min-h-[440px]">{children}</div>
    </div>
  );
}

export default function IntroGallery() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Preview</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            &ldquo;Ambit introduced you to&rdquo; — four directions
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            The intro card is the whole pitch, so it should feel like a warm, high-signal introduction
            — on-brand terracotta, real reasoning, a real next step. Tell me which one and I&apos;ll wire it
            into the hero carousel.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-20 justify-items-center">
          <Frame
            label="A · Editorial"
            desc="Warm white card, terracotta eyebrow, a 'why you two' reasoning block, and a clear ask."
          >
            <OptionEditorial intro={AMARA} />
          </Frame>
          <Frame
            label="B · Note from your agent"
            desc="Reads like Ambit personally wrote you, with the person as a rich chip and a fit score."
          >
            <OptionAgentNote intro={AMARA} />
          </Frame>
          <Frame
            label="C · Spotlight"
            desc="Photo-forward and cinematic. Highest visual impact — the person is the hero."
          >
            <OptionSpotlight intro={AMARA} />
          </Frame>
          <Frame
            label="D · Split"
            desc="Portrait rail with a terracotta wash beside the intro. Compact and magazine-like."
          >
            <OptionSplit intro={AMARA} />
          </Frame>
        </div>

        <div className="mt-24 text-center">
          <div className="text-sm font-semibold text-foreground">Same options with a second person</div>
          <p className="mt-1 text-xs text-muted-foreground">so you can see them with different content</p>
        </div>
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-20 justify-items-center">
          <Frame label="A · Editorial" desc="">
            <OptionEditorial intro={SOFIA} />
          </Frame>
          <Frame label="C · Spotlight" desc="">
            <OptionSpotlight intro={SOFIA} />
          </Frame>
        </div>
      </div>
    </div>
  );
}
