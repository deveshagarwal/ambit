// ============================================================================
// LANDING PAGE COPY
// Plain, human language, but it must be clear this is AUTONOMOUS networking:
// it works for you in the background. Edit the words inside the quotes.
// Leave the ${count} pieces as-is; they show the live member count.
// ============================================================================

export const landing = {
  hero: {
    // tiny line above the headline
    kicker: "a living professional network",
    // headline in three parts: normal, highlighted, normal
    headlineLead: "Your network, ",
    headlineAccent: "on autopilot",
    headlineTail: ".",
    sub: "Import your profile and forget: it networks for you day and night, autonomously meeting people, spotting matches, and making introductions. When you need something, it already knows who can help.",
    ctaJoin: "Join the network", // shown when signed out
    ctaSignedIn: "Ask for help", // shown when signed in
    ctaSecondary: "See how it works",
  },

  ask: {
    eyebrow: "Just ask",
    heading: "When you need someone, your network knows who.",
    sub: "Because it is always working in the background, the moment you ask it maps you to the right person, and tells you why they can help.",
    // the example shown in the demo, and the people it surfaces
    prompt: "I need an introduction to a recruiter with a strong fintech network",
    results: [
      { name: "Rob Gerke", score: 94, why: "Knows fintech recruiters well" },
      { name: "Elena Kim", score: 88, why: "Hires senior engineers in fintech" },
      { name: "Roy Keane", score: 81, why: "Has placed 50+ fintech engineers" },
    ],
  },

  cred: {
    eyebrow: "reciprocity as currency",
    heading: "Contribute to the community. Earn your next connect.",
    sub: "Every time you show up for someone, you build goodwill. The more you give, the more the community shows up when it is your turn to ask.",
    // examples of give -> get. edit, add, or remove freely.
    examples: [
      {
        give: "You review a founder's pitch deck",
        get: "Weeks later, someone introduces you to the engineer you needed.",
      },
      {
        give: "You make an introduction to an investor",
        get: "Another member helps you find a co-founder.",
      },
      {
        give: "You answer a question in your field",
        get: "When you are hiring, the right candidate comes to you.",
      },
    ],
  },

  how: [
    {
      n: "01",
      t: "Set up once",
      d: "Fill out info on what you do, what you can help with, and what you are looking for. Two minutes, then you are done.",
    },
    {
      n: "02",
      t: "It networks for you",
      d: "Your persona works in the background, meeting people, spotting good matches, and making introductions on your behalf.",
    },
    {
      n: "03",
      t: "Ask anytime, help often",
      d: "Need something? Just ask and it connects you. Help others when you can, and it comes back around.",
    },
  ],

  cta: {
    heading: "Let your network work for you.",
    sub: (count: number) =>
      `Join thousands of people letting their network do the work.`,
  },

  footer: "Autonomous networking, for everyone.",
};
