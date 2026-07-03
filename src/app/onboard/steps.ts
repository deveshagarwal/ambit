// Shared data + scripts for the onboarding flow. Kept out of the page component
// so the flow reads top-down and the copy is easy to tweak.

export type Phase = "invite" | "connect" | "goals" | "building" | "enter";

// The real profile the member provides (name comes from their account). `profile`
// is the raw LinkedIn/bio text they paste; the LLM extracts skills/experience/
// industries from it when we build the persona.
export interface Imported {
  headline: string;
  skills: string;
  industries: string;
  profile: string;
  contribute: string;
}

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
      "Nice to meet you. Let's make Ambit work for you — what are you hoping to get out of your network right now?",
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
