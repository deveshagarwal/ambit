import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ensureSeeded } from "@/lib/bootstrap";
import { landing } from "@/content/landing";
import Logo from "@/components/Logo";
import JoinCTA from "@/components/JoinCTA";
import Waitlist from "@/components/Waitlist";
import HeroCarousel from "@/components/HeroCarousel";
import LogoMarquee from "@/components/LogoMarquee";
import { Button } from "@/components/ui/button";

// The landing is the same for everyone — no signed-in/out branching. "Sign in"
// takes returning members straight home; "Expand your ambit" opens sign-up.
export default async function Landing() {
  await ensureSeeded();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO: editorial, light. Two columns — the pitch on the left, a fanned
          carousel of the intros Ambit makes on the right. */}
      <section className="relative overflow-hidden bg-background pt-6 pb-24 sm:pb-28">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-serif font-semibold text-2xl sm:text-3xl tracking-tight">
            <Logo size={30} className="text-foreground" /> Ambit
          </div>
          <div className="flex items-center gap-5">
            <SignInButton forceRedirectUrl="/home">
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/onboard">
              <Button variant="outline">{landing.hero.ctaJoin}</Button>
            </SignUpButton>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-16 sm:pt-20 flex flex-col items-center gap-14 xl:flex-row xl:items-center xl:gap-10">
          {/* Left: the pitch */}
          <div className="w-full xl:w-1/2 flex flex-col items-center text-center xl:items-start xl:text-left">
            <span className="mt-4 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              {landing.hero.kicker}
            </span>
            <h1 className="font-serif mt-4 text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.02]">
              {landing.hero.headlineLead}
              <span className="italic font-normal">{landing.hero.headlineAccent}</span>
              {landing.hero.headlineTail}
            </h1>
            <p className="mt-7 text-lg text-muted-foreground leading-relaxed max-w-md">
              {landing.hero.sub}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center xl:justify-start gap-3">
              <SignUpButton forceRedirectUrl="/onboard">
                <Button size="lg" className="h-11 px-6 text-base">
                  {landing.hero.ctaJoin}
                </Button>
              </SignUpButton>
              {/* "See how it works" secondary CTA hidden for now */}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <SignInButton forceRedirectUrl="/home">
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground cursor-pointer"
                >
                  Sign in
                </button>
              </SignInButton>
            </p>
          </div>

          {/* Right: the intros, with a drifting strip of scenes above them */}
          <div className="w-full xl:w-1/2 flex flex-col items-center gap-8">
            <LogoMarquee />
            <div id="intros" className="w-full scroll-mt-24">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA: waitlist capture */}
      <section id="waitlist" className="max-w-6xl mx-auto px-5 pb-24 scroll-mt-20">
        <div className="rounded-2xl border border-border bg-card px-8 py-14 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight">
            {landing.cta.heading}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">{landing.cta.sub}</p>
          <div className="mt-7">
            <Waitlist />
            <p className="mt-3 text-xs text-muted-foreground">
              {landing.hero.invitePrompt}{" "}
              <JoinCTA
                signedIn={false}
                href="/onboard"
                label={landing.hero.inviteLink}
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground cursor-pointer"
              />
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
