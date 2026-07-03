import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ensureSeeded } from "@/lib/bootstrap";
import { getMember } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";
import { landing } from "@/content/landing";
import Logo from "@/components/Logo";
import JoinCTA from "@/components/JoinCTA";
import HeroCarousel from "@/components/HeroCarousel";
import LogoMarquee from "@/components/LogoMarquee";

export default async function Landing() {
  await ensureSeeded();
  const { userId } = await auth();

  // Signed in: skip the marketing page entirely and drop them into the real
  // interface. Members go to the app; a signed-in account without a member yet
  // still needs to build its agent, so it goes to onboarding.
  if (userId) {
    const id = await getCurrentMemberId();
    const hasMember = !!(id && (await getMember(id)));
    redirect(hasMember ? "/home" : "/onboard");
  }

  // Signed out below: the landing page markets to visitors and the CTA opens
  // Clerk sign-up (which then routes into onboarding).
  const signedIn = false;
  const primaryHref = "/onboard";
  const primaryLabel = landing.hero.ctaJoin;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO: editorial, light. Two columns — the pitch on the left, a fanned
          carousel of the intros Ambit makes on the right. */}
      <section className="relative overflow-hidden bg-background pt-6 pb-24 sm:pb-28">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif font-semibold text-xl tracking-tight">
            <Logo size={22} className="text-foreground" /> Ambit
          </div>
          <JoinCTA signedIn={signedIn} href={primaryHref} label={primaryLabel} />
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
              <JoinCTA
                signedIn={signedIn}
                href={primaryHref}
                label={primaryLabel}
                size="lg"
                className="h-11 px-6 text-base"
              />
              {/* "See how it works" secondary CTA hidden for now */}
            </div>
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
    </div>
  );
}
