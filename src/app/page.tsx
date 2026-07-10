import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ensureSeeded } from "@/lib/bootstrap";
import { landing } from "@/content/landing";
import Logo from "@/components/Logo";
import HeroCarousel from "@/components/HeroCarousel";
import LogoMarquee from "@/components/LogoMarquee";
import { Button } from "@astryxdesign/core/Button";

// The landing is the same for everyone — no signed-in/out branching. "Sign in"
// takes returning members straight home; "Expand your ambit" opens sign-up.
export default async function Landing() {
  await ensureSeeded();

  return (
    <div className="min-h-screen bg-body text-primary">
      {/* HERO: editorial, light. Two columns — the pitch on the left, a fanned
          carousel of the intros Ambit makes on the right. */}
      <section className="relative overflow-hidden bg-body pt-6 pb-24 sm:pb-28">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-heading font-semibold text-2xl sm:text-3xl tracking-tight">
            <Logo size={30} className="text-primary" /> Ambit
          </div>
          <div className="flex items-center gap-5">
            <SignInButton forceRedirectUrl="/home">
              <button
                type="button"
                className="text-sm font-medium text-secondary hover:text-primary transition-colors"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/onboard">
              <Button
                label={landing.hero.ctaJoin}
                variant="ghost"
                className="border border-border"
              />
            </SignUpButton>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-16 sm:pt-20 flex flex-col items-center gap-14 xl:flex-row xl:items-center xl:gap-10">
          {/* Left: the pitch */}
          <div className="w-full xl:w-1/2 flex flex-col items-center text-center xl:items-start xl:text-left">
            <span className="mt-4 text-[11px] uppercase tracking-[0.28em] text-secondary">
              {landing.hero.kicker}
            </span>
            <h1 className="font-heading mt-4 text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.02]">
              {landing.hero.headlineLead}
              <span className="italic font-normal">{landing.hero.headlineAccent}</span>
              {landing.hero.headlineTail}
            </h1>
            <p className="mt-7 text-lg text-secondary leading-relaxed max-w-md">
              {landing.hero.sub}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center xl:justify-start gap-3">
              <SignUpButton forceRedirectUrl="/onboard">
                <Button
                  label={landing.hero.ctaJoin}
                  variant="primary"
                  size="lg"
                  className="h-11 px-6 text-base"
                />
              </SignUpButton>
              {/* "See how it works" secondary CTA hidden for now */}
            </div>
            <p className="mt-4 text-sm text-secondary">
              Already have an account?{" "}
              <SignInButton forceRedirectUrl="/home">
                <button
                  type="button"
                  className="font-medium text-primary underline underline-offset-4 hover:text-primary cursor-pointer"
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

      {/* Small footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-heading font-semibold tracking-tight text-primary">
            <Logo size={20} className="text-primary" /> Ambit
          </div>
          <p className="text-xs text-secondary">
            © {new Date().getFullYear()} Ambit · Invite-only while the network grows.
          </p>
        </div>
      </footer>
    </div>
  );
}
