// ============================================================================
// LANDING PAGE COPY
// Ambit is a SOCIAL INTELLIGENCE LAYER: it learns who you are and what you're
// into, then quietly finds your scene, your collaborators, your next obsession,
// and the people who make your life bigger. Warm and human, not corporate.
// Edit the words inside the quotes.
// ============================================================================

export const landing = {
  hero: {
    // tiny line above the headline
    kicker: "The anti-LinkedIn network",
    // headline in three parts: normal, highlighted (italic serif), normal
    headlineLead: "Meet the person who changes ",
    headlineAccent: "everything",
    headlineTail: ".",
    sub: "Looking for a cofounder? A mentor? An engineer? Let your network do the work. Ambit learns who you are and what you need - then introduces you. No feed, no titles, no performing.",
    ctaJoin: "Expand your Ambit", // shown when signed out (opens the waitlist)
    ctaSignedIn: "Ask Ambit", // shown when signed in
    ctaSecondary: "See how it works",
    invitePrompt: "Have an invite code?", // small link next to the primary CTA
    inviteLink: "Sign up",
  },

  ask: {
    eyebrow: "Just ask",
    heading: "Looking for something? It already knows who.",
    sub: "Ambit is always learning who's in your orbit. The moment you ask — for a collaborator, a scene, a person who just gets it — it maps you to the right people and tells you why.",
    // the example shown in the demo, and the people it surfaces
    prompt: "I just moved here and want to find a serious ceramics scene",
    results: [
      { name: "Mara Lindqvist", score: 95, why: "Runs a small, serious throwing studio" },
      { name: "Theo Adeyemi", score: 87, why: "Knows every maker collective in the city" },
      { name: "Priya Nair", score: 80, why: "Hosts a monthly night for hands-on makers" },
    ],
  },

  cred: {
    eyebrow: "reciprocity as currency",
    heading: "Show up for people. It comes back around.",
    sub: "Every time you open a door for someone, you build goodwill. The more you give, the more your community shows up when it's your turn to look.",
    // examples of give -> get. edit, add, or remove freely.
    examples: [
      {
        give: "You bring someone new into your run club",
        get: "Months later, a stranger introduces you to your next collaborator.",
      },
      {
        give: "You invite someone to a tasting you host",
        get: "When you land in a new city, someone gives you a whole table.",
      },
      {
        give: "You share a scene you love with a newcomer",
        get: "Your next obsession finds its way to you through them.",
      },
    ],
  },

  how: [
    {
      n: "01",
      t: "Tell it who you are",
      d: "What you do, what you're into, the kind of people and rooms you want more of. Two minutes, then you're done.",
    },
    {
      n: "02",
      t: "It finds your people",
      d: "Ambit works the network in the background — meeting people, spotting your scene, and surfacing the connections worth making.",
    },
    {
      n: "03",
      t: "Ask anytime, give often",
      d: "Looking for a collaborator, a crew, or your next obsession? Just ask. Open doors for others, and it comes back around.",
    },
  ],

  testimonials: {
    eyebrow: "from the network",
    heading: "People found their people.",
    quotes: [
      {
        quote:
          "I moved cities for work and knew no one. Within a month Ambit had put me in a climbing crew, a supper club, and a record-listening night. It rebuilt my whole social life.",
        name: "Nadia Osei",
        detail: "Designer, moved to Berlin",
      },
      {
        quote:
          "I'd been sitting on half a record for two years. Ambit introduced me to the co-writer who finished it with me. We're playing it live next month.",
        name: "Marcus Tran",
        detail: "Musician",
      },
      {
        quote:
          "I asked for people obsessed with old film cameras and it found three within walking distance. One of them is now my closest friend.",
        name: "Priya Shah",
        detail: "Photographer",
      },
      {
        quote:
          "It doesn't feel like a networking app. It feels like the friend who always knows exactly who you should meet.",
        name: "Daniel Reyes",
        detail: "Chef & supper-club host",
      },
    ],
  },

  cta: {
    heading: "Find the people who make your life bigger.",
    sub: "Ambit is invite-only while the network grows. Leave your email and we'll send an invite as spots open.",
  },

  footer: "A social intelligence layer for the rest of your life.",
};
