// Shared data + scripts for the onboarding flow. Kept out of the page component
// so the flow reads top-down and the copy is easy to tweak.

// The flow now sells before it gates: import → reveal the built profile → set
// goals → apply → THEN the invite gate (waitlist). Member creation is deferred to
// the gate. `loading` covers the mount-time check for an existing member/application.
export type Phase =
  | "loading"
  | "upload"
  | "reveal"
  | "goals"
  | "apply"
  | "waitlist"
  | "building"
  | "enter";

// What the upload step hands to the review step: the AI-structured fields (used to
// prefill the editable form) plus the raw résumé text (mined later by buildPersona).
// When a member chooses to skip the upload and fill the form by hand, EMPTY_PREFILL
// is passed instead.
export interface Prefill {
  rawText: string;
  headline: string;
  work: { title: string; company: string; years: string }[];
  education: { school: string; degree: string }[];
  skills: string[];
  industries: string[];
  fromUpload: boolean; // true when AI prefilled it, so the review step can say so
  aiOk?: boolean; // false when PDF text was read but LLM structuring failed
  warning?: string;
}

export const EMPTY_PREFILL: Prefill = {
  rawText: "",
  headline: "",
  work: [],
  education: [],
  skills: [],
  industries: [],
  fromUpload: false,
};

// The real profile the member provides (name comes from their account). `profile`
// is the raw LinkedIn/bio text they paste; the LLM extracts skills/experience/
// industries from it when we build the persona.
export interface Imported {
  headline: string;
  skills: string;
  industries: string;
  profile: string; // raw about + résumé text, stored + mined by the LLM
  contribute: string;
  work: { title: string; company: string; years: string }[];
  education: { school: string; degree: string }[];
}

// The goals screen (no longer a chat): three fields the member reviews, each
// AI-prefilled from their profile. Every answer maps onto a field of the persona
// we build at the gate. `label` is the short field heading; `prompt` is the
// supporting question; `placeholder` seeds the empty state if AI is unavailable.
export interface GoalQuestion {
  key: "needs" | "meet" | "offer";
  label: string;
  prompt: string;
  placeholder: string;
}

export const GOAL_QUESTIONS: GoalQuestion[] = [
  {
    key: "needs",
    label: "What you're looking for",
    prompt: "What are you hoping to get out of your network right now?",
    placeholder: "Raise a seed round, find a technical co-founder, break into fintech…",
  },
  {
    key: "meet",
    label: "Who you want to meet",
    prompt: "Who would be most valuable for you to meet?",
    placeholder: "Seed-stage fintech VCs, senior ML engineers, design partners…",
  },
  {
    key: "offer",
    label: "What you can offer",
    prompt: "Networks work best when they're mutual — what can you help others with?",
    placeholder: "Intros to VCs, pitch feedback, hiring advice…",
  },
];
