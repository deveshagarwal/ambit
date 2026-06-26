import Link from "next/link";
import { ensureSeeded } from "@/lib/bootstrap";
import { getMember, memberCount } from "@/lib/store/repo";
import { getCurrentMemberId } from "@/lib/session";
import { landing } from "@/content/landing";
import EmbeddingSpace from "@/components/EmbeddingSpace";

export default async function Landing() {
  await ensureSeeded();
  const count = await memberCount();
  const id = await getCurrentMemberId();
  const signedIn = !!(id && (await getMember(id)));
  const primaryHref = signedIn ? "/ask" : "/onboard";
  const primaryLabel = signedIn ? landing.hero.ctaSignedIn : landing.hero.ctaJoin;

  return (
    <div className="text-[var(--foreground)]">
      {/* HERO: cinematic. The living cloud drifts toward you behind centered text. */}
      <section className="relative overflow-hidden bg-black text-white min-h-[calc(100svh-3.5rem)] flex items-center justify-center">
        <div id="space" className="absolute inset-0 wv-drift">
          <EmbeddingSpace mode="ambient" theme="dark" fill />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />

        <div className="relative w-full px-5 py-20 text-center flex flex-col items-center pointer-events-none">
          <div className="text-[11px] uppercase tracking-[0.5em] text-white/45 mb-7">
            {landing.hero.kicker}
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.98] max-w-3xl">
            {landing.hero.headlineLead}
            <span className="italic font-light text-[#a99bff]">{landing.hero.headlineAccent}</span>
            {landing.hero.headlineTail}
          </h1>
          <p className="mt-7 text-lg text-white/60 leading-relaxed max-w-md">{landing.hero.sub}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
            <Link href={primaryHref} className="btn btn-primary text-base px-6 py-3">
              {primaryLabel}
            </Link>
            <Link
              href="#work"
              className="btn text-base px-6 py-3 border border-white/25 text-white hover:bg-white/10"
            >
              {landing.hero.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* JUST ASK */}
      <section id="work" className="max-w-6xl mx-auto px-5 py-16 border-t border-[var(--border)]">
        <div className="max-w-2xl mb-8">
          <div className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wide">
            {landing.ask.eyebrow}
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            {landing.ask.heading}
          </h2>
          <p className="mt-3 text-[var(--muted)] leading-relaxed max-w-xl">{landing.ask.sub}</p>
        </div>

        <div className="cloud-dark rounded-3xl p-3 overflow-hidden">
          <EmbeddingSpace mode="query" theme="dark" height={460} />
        </div>
      </section>

      {/* CRED AND RECIPROCITY */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-[var(--border)]">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wide">
            {landing.cred.eyebrow}
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            {landing.cred.heading}
          </h2>
          <p className="mt-3 text-[var(--muted)] leading-relaxed">{landing.cred.sub}</p>
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {landing.cred.examples.map((ex, i) => (
            <div key={i} className="card p-5">
              <div className="text-sm font-medium leading-snug">{ex.give}</div>
              <div className="my-3 flex items-center gap-2 text-[var(--accent)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs font-semibold uppercase tracking-wide">builds goodwill</span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <div className="text-sm leading-snug text-[var(--muted)]">{ex.get}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-16 border-t border-[var(--border)]">
        <div className="grid sm:grid-cols-3 gap-8">
          {landing.how.map((c) => (
            <div key={c.n}>
              <div className="text-[var(--accent)] font-mono text-sm font-semibold">{c.n}</div>
              <h3 className="mt-2 font-semibold text-lg">{c.t}</h3>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-6xl mx-auto px-5 pb-24">
        <div className="card px-8 py-14 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{landing.cta.heading}</h2>
          <p className="mt-3 text-[var(--muted)] max-w-lg mx-auto">{landing.cta.sub(count)}</p>
          <Link href={primaryHref} className="btn btn-primary mt-7 text-base px-7 py-3">
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-5 py-8 text-sm text-[var(--muted)] flex items-center justify-between">
          <span className="font-semibold text-[var(--foreground)]">✦ Weave</span>
          <span>{landing.footer}</span>
        </div>
      </footer>
    </div>
  );
}
