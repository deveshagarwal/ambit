import { aiEnabled, chat, chatJSON } from "./ai";
import { NeedParse, ProfileExtraction } from "./types";
import { keywordTags } from "./text";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const ONBOARD_SYSTEM = `You are Robin, the onboarding agent for Weave, an autonomous networking community.
Your job is to interview a new member in a warm, curious, concise way so we can build their node in the community knowledge graph.
Cover, over a few turns: who they are and what they do, their concrete skills, notable experiences, the industries/domains they know, what they can offer others, and what they're currently looking for.
Ask ONE focused question at a time. Keep each reply to 1-3 sentences. Acknowledge what they said before asking the next thing.
When you have a well-rounded picture (usually after 4-6 exchanges), tell them they're all set and that they can hit "Build my profile".`;

// Scripted fallback interviewer when no AI key is configured.
const SCRIPT = [
  "Hey, I'm Robin. I'll get you set up on Weave. To start, what's your name and what do you do?",
  "Love it. What are a few concrete skills or things people come to you for?",
  "Got it. What's a project or experience you're proud of or known for?",
  "Which industries or domains do you know your way around?",
  "How could you help other people in the community right now?",
  "Last one: what are you looking for at the moment? You're all set after this, hit Build my profile.",
];

export async function onboardTurn(history: ChatMsg[]): Promise<string> {
  if (!aiEnabled()) {
    const asked = history.filter((m) => m.role === "assistant").length;
    return SCRIPT[Math.min(asked, SCRIPT.length - 1)];
  }
  return chat([
    { role: "system", content: ONBOARD_SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]);
}

export async function extractProfile(
  history: ChatMsg[],
): Promise<ProfileExtraction> {
  const transcript = history
    .map((m) => `${m.role === "user" ? "Member" : "Robin"}: ${m.content}`)
    .join("\n");

  if (!aiEnabled()) return fallbackProfile(history);

  try {
    const raw = await chatJSON<ProfileExtraction>([
      {
        role: "system",
        content: `Extract a structured member profile from this onboarding conversation.
Return JSON: { "name": string, "headline": string, "bio": string, "attributes": [{ "type": one of skill|experience|industry|interest|offer|need, "value": string }] }.
Be generous: capture every distinct skill, experience, industry, offer, and need mentioned. Values should be short noun phrases.`,
      },
      { role: "user", content: transcript },
    ]);
    return ProfileExtraction.parse(raw);
  } catch {
    return fallbackProfile(history);
  }
}

export async function parseNeed(text: string): Promise<NeedParse> {
  if (!aiEnabled()) {
    return {
      summary: text,
      tags: keywordTags(text),
      desired_attribute_types: ["offer", "skill", "experience", "industry"],
    };
  }
  try {
    const raw = await chatJSON<NeedParse>([
      {
        role: "system",
        content: `A member is asking the community for help. Parse their request.
Return JSON: { "summary": string, "tags": string[] (normalized lowercase keywords), "desired_attribute_types": array of skill|experience|industry|interest|offer|need }.
Tags should include synonyms and the domain (e.g. "fintech recruiter" -> ["fintech","recruiting","hiring","talent"]).`,
      },
      { role: "user", content: text },
    ]);
    return NeedParse.parse(raw);
  } catch {
    return {
      summary: text,
      tags: keywordTags(text),
      desired_attribute_types: ["offer", "skill", "experience", "industry"],
    };
  }
}

// ---- Talk to the organism ----

export interface OrganismResult {
  reply: string;
  intent: "need" | "offer" | "smalltalk" | "profile";
  query?: string;
}

const ORGANISM_SYSTEM = `You are the living voice of Weave, an entire professional network speaking as one organism.
You know every member, what they can offer, and what they need. You are warm, sharp, concise, and proactive.
Speak in the first person AS the network ("I know a few people...", "Let me look across everyone I hold...").
Keep every reply to 1-3 sentences. Remind people, gently and naturally, that helping others here builds their own cred.
When someone expresses a need, an ask for an intro, advice, or a particular kind of person, surface that you can find people for them.

Always reply with JSON: { "reply": string, "intent": "need" | "offer" | "smalltalk" | "profile", "query"?: string }.
- intent "need": they are asking for help, an introduction, a recommendation, or a specific kind of person. Set "query" to a crisp distilled search string describing who they need.
- intent "offer": they are offering to help others or sharing what they can give.
- intent "profile": they are mainly telling you about themselves.
- intent "smalltalk": anything else.
"reply" is what you, the organism, say back to them.`;

const NEED_SIGNALS = [
  "need",
  "looking for",
  "intro",
  "connect",
  "find",
  "help with",
  "recommend",
  "who can",
];

export async function organismTurn(history: ChatMsg[]): Promise<OrganismResult> {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  if (!aiEnabled()) {
    const lower = lastUser.toLowerCase();
    if (NEED_SIGNALS.some((s) => lower.includes(s))) {
      return {
        reply: "Let me search the network for people who can help with that.",
        intent: "need",
        query: lastUser,
      };
    }
    return {
      reply:
        "I'm the whole network, listening. Tell me what you need or who you could help today, and I'll find the right people.",
      intent: "smalltalk",
    };
  }

  try {
    const raw = await chatJSON<OrganismResult>([
      { role: "system", content: ORGANISM_SYSTEM },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ]);
    const intent =
      raw.intent === "need" ||
      raw.intent === "offer" ||
      raw.intent === "profile" ||
      raw.intent === "smalltalk"
        ? raw.intent
        : "smalltalk";
    const reply =
      typeof raw.reply === "string" && raw.reply.trim()
        ? raw.reply.trim()
        : "I'm here. What do you need, or who could you help today?";
    const query =
      intent === "need"
        ? typeof raw.query === "string" && raw.query.trim()
          ? raw.query.trim()
          : lastUser
        : undefined;
    return { reply, intent, query };
  } catch {
    const lower = lastUser.toLowerCase();
    if (NEED_SIGNALS.some((s) => lower.includes(s))) {
      return {
        reply: "Let me search the network for people who can help with that.",
        intent: "need",
        query: lastUser,
      };
    }
    return {
      reply: "I'm here, listening. Tell me what you need or who you could help today.",
      intent: "smalltalk",
    };
  }
}

// ---- Agent persona builder (LinkedIn import + survey) ----

export interface PersonaInput {
  name: string;
  headline?: string;
  linkedin?: string;
  contribute?: string;
  needs?: string;
  skills?: string;
  industries?: string;
}

function splitItems(s?: string): string[] {
  if (!s) return [];
  return Array.from(
    new Set(
      s
        .split(/[\n,;•]+/)
        .map((x) => x.replace(/^[-*\s]+/, "").trim())
        .filter((x) => x.length > 1 && x.length < 80),
    ),
  ).slice(0, 12);
}

export async function buildPersona(input: PersonaInput): Promise<ProfileExtraction> {
  if (aiEnabled()) {
    try {
      const raw = await chatJSON<ProfileExtraction>([
        {
          role: "system",
          content: `Build a structured networking persona for a member's AI agent.
Return JSON: { "name": string, "headline": string, "bio": string, "attributes": [{ "type": one of skill|experience|industry|interest|offer|need, "value": string }] }.
Rules: everything the person can CONTRIBUTE becomes type "offer". Everything they NEED becomes type "need". Pull skills, experiences, industries and interests out of the pasted LinkedIn text. Values are short noun phrases. Be generous and specific.`,
        },
        {
          role: "user",
          content: `Name: ${input.name}
Headline: ${input.headline ?? ""}
What they can contribute: ${input.contribute ?? ""}
What they need help with: ${input.needs ?? ""}
Skills: ${input.skills ?? ""}
Industries: ${input.industries ?? ""}

Pasted LinkedIn profile:
${(input.linkedin ?? "").slice(0, 4000)}`,
        },
      ]);
      const parsed = ProfileExtraction.parse(raw);
      // Guarantee the explicit survey answers survive even if the model drops them.
      const merged = [...parsed.attributes];
      for (const v of splitItems(input.contribute)) merged.push({ type: "offer", value: v });
      for (const v of splitItems(input.needs)) merged.push({ type: "need", value: v });
      return { ...parsed, name: input.name || parsed.name, attributes: merged };
    } catch {
      // fall through to structured fallback
    }
  }

  const attributes: ProfileExtraction["attributes"] = [];
  for (const v of splitItems(input.skills)) attributes.push({ type: "skill", value: v });
  for (const v of splitItems(input.industries)) attributes.push({ type: "industry", value: v });
  for (const v of splitItems(input.contribute)) attributes.push({ type: "offer", value: v });
  for (const v of splitItems(input.needs)) attributes.push({ type: "need", value: v });

  return {
    name: input.name || "New Member",
    headline: input.headline || input.linkedin?.split("\n")[0]?.slice(0, 80) || "Weave member",
    bio:
      (input.linkedin || input.contribute || "").slice(0, 220) ||
      `${input.name} is building their persona on Weave.`,
    attributes,
  };
}

// --- Heuristic fallback profile builder ---
function fallbackProfile(history: ChatMsg[]): ProfileExtraction {
  const userMsgs = history.filter((m) => m.role === "user").map((m) => m.content);
  const rawName = (userMsgs[0] ?? "New Member")
    .replace(/^\s*(hi|hey|hello)[,!. ]+/i, "")
    .replace(/^\s*(i'?m|i am|my name is|this is|it'?s)\s+/i, "")
    .split(/[,.]| and | who | a | an /i)[0]
    .trim();
  const name = rawName.slice(0, 40) || "New Member";
  const attributes: ProfileExtraction["attributes"] = [];
  const push = (type: ProfileExtraction["attributes"][number]["type"], src?: string) => {
    if (!src) return;
    for (const t of keywordTags(src).slice(0, 5))
      attributes.push({ type, value: t });
  };
  push("skill", userMsgs[1]);
  push("experience", userMsgs[2]);
  push("industry", userMsgs[3]);
  push("offer", userMsgs[4]);
  push("need", userMsgs[5]);
  return {
    name,
    headline: userMsgs[0]?.slice(0, 80) ?? "Weave member",
    bio: userMsgs.join(" ").slice(0, 200),
    attributes,
  };
}
