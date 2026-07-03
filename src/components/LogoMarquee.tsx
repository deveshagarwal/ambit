"use client";

// Ambient social-proof strip: the companies Ambit's members come from, drifting
// past. CSS-only, monochrome dark marks faded back, with gradient edges so the
// row dissolves into the light hero. Pauses for reduced-motion.
//
// Marks are served monochrome-black from the Simple Icons CDN. Slugs here were
// verified to resolve (several big-tech brands, e.g. Microsoft/Amazon, have been
// removed from Simple Icons for trademark reasons — don't re-add them blindly).

const LOGOS = [
  { slug: "google", name: "Google" },
  { slug: "apple", name: "Apple" },
  { slug: "meta", name: "Meta" },
  { slug: "netflix", name: "Netflix" },
  { slug: "nvidia", name: "Nvidia" },
  { slug: "tesla", name: "Tesla" },
  { slug: "stripe", name: "Stripe" },
  { slug: "spotify", name: "Spotify" },
  { slug: "airbnb", name: "Airbnb" },
  { slug: "figma", name: "Figma" },
  { slug: "github", name: "GitHub" },
  { slug: "uber", name: "Uber" },
];

export default function LogoMarquee() {
  // Doubled so the -50% translate loops seamlessly.
  const row = [...LOGOS, ...LOGOS];
  return (
    <div className="relative w-full max-w-xl overflow-hidden">
      <div className="wv-marquee flex w-max items-center gap-10">
        {row.map((logo, i) => (
          <img
            key={i}
            src={`https://cdn.simpleicons.org/${logo.slug}/black`}
            alt={logo.name}
            className="h-6 w-auto shrink-0 opacity-40"
            loading="lazy"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
