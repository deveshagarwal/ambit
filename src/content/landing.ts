// ============================================================================
// LANDING PAGE COPY
// Edit the text in this file to change what the landing page says.
// It is plain text. Keep the quotes and commas; change only the words inside.
// The {count} pieces use the live member count, leave the ${count} as-is.
// ============================================================================

export const landing = {
  hero: {
    // tiny letter-spaced line above the headline
    kicker: "a living professional network",
    // the headline is in three parts: normal, accent-colored, normal
    headlineLead: "A network that is ",
    headlineAccent: "alive",
    headlineTail: ".",
    sub: "Every person a vector. Every need a path. Tell it what you need, and it finds your people.",
    ctaJoin: "Enter the network", // shown when signed out
    ctaSignedIn: "Talk to the network", // shown when signed in
    ctaSecondary: "See how it works",
  },

  ask: {
    eyebrow: "Just ask",
    heading: "Ask, and the network finds your person",
    sub: "Say what you need in plain language. Your ask ripples through everyone the network holds and lands on the person who fits.",
    // the prompt typed into the demo, and the people it surfaces
    prompt: "I need an intro to a recruiter with a strong fintech network",
    results: [
      { name: "Priya Park", score: 94, why: "Deep fintech recruiting network" },
      { name: "Elena Kim", score: 88, why: "Sources senior eng, hiring funnels" },
      { name: "Hugo Roy", score: 81, why: "Placed 50+ fintech engineers" },
    ],
  },

  cred: {
    eyebrow: "Cred is reciprocity",
    heading: "Help to earn cred. Cred is what gets you helped.",
    sub: "The network runs on give and take. Every time you show up for someone, your standing grows, and that standing is exactly what the network spends to find help for you when you need it.",
    // examples of the give -> get loop. edit, add, or remove freely.
    examples: [
      {
        give: "You review a founder's pitch deck",
        get: "Weeks later, the network finds you the backend engineer you needed.",
      },
      {
        give: "You make a warm intro to an investor",
        get: "Someone surfaces a design partner right as you launch.",
      },
      {
        give: "You answer a question on FDA clearance",
        get: "The network connects you to a recruiter when you start hiring.",
      },
    ],
  },

  how: [
    {
      n: "01",
      t: "Build your agent persona",
      d: "Import your LinkedIn and answer a short survey. Your agent learns what you can contribute and what you need.",
    },
    {
      n: "02",
      t: "Talk to the network",
      d: "Ask for anything in plain language. The network finds the people closest to your need, with a reason for each.",
    },
    {
      n: "03",
      t: "Earn cred",
      d: "Help others and make intros. Cred is the standing that gets the network to show up for you in return.",
    },
  ],

  cta: {
    heading: "Let the network work for you.",
    sub: (count: number) =>
      `Join ${count} members building a community where the right introduction is always one ask away.`,
  },

  footer: "A living professional network.",
};
