// Shared data + scripts for the onboarding flow. Kept out of the page component
// so the flow reads top-down and the copy is easy to tweak.

export type Phase = "connect" | "analyzing" | "goals" | "building" | "waitlist";

// What the (simulated) LinkedIn import fills in before the goals interview.
// Once a real LinkedIn connection exists this is the shape we map onto.
export interface Imported {
  headline: string;
  skills: string;
  industries: string;
  contribute: string;
}

export const SIMULATED_LINKEDIN: Imported = {
  headline: "Founder, B2B SaaS",
  skills: "fundraising, product, go-to-market",
  industries: "fintech, b2b saas",
  contribute: "warm intros to seed VCs\npitch deck feedback\nhiring senior engineers",
};

// The steps the "AI" appears to work through while reading the profile. Purely
// cosmetic — they check off one by one to make the analysis feel real.
export const ANALYSIS_STEPS = [
  "Reading your LinkedIn profile",
  "Extracting skills and experience",
  "Mapping the industries you know",
  "Finding what you can offer the network",
  "Placing your node in the graph",
];

// The chat-style goals interview. Each question the agent asks maps its answer
// onto a field of the persona we build at the end.
export interface GoalQuestion {
  key: "needs" | "meet" | "offer";
  prompt: string;
  placeholder: string;
}

export const GOAL_QUESTIONS: GoalQuestion[] = [
  {
    key: "needs",
    prompt:
      "Nice to meet you. I read through your profile — let's make Ambit work for you. What are you hoping to get out of your network right now?",
    placeholder: "raise a seed round, find a technical co-founder, break into fintech…",
  },
  {
    key: "meet",
    prompt: "Got it. Who would be most valuable for you to meet? Be as specific as you like.",
    placeholder: "seed-stage fintech VCs, senior ML engineers, design partners…",
  },
  {
    key: "offer",
    prompt:
      "Last one. Networks work best when they're mutual — what could you help other people with?",
    placeholder: "intros to VCs, pitch feedback, hiring advice…",
  },
];
