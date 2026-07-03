import { z } from "zod";

// The kinds of knowledge that hang off a person node in the graph.
export const ATTRIBUTE_TYPES = [
  "skill", // something they can do
  "experience", // a role / thing they've done
  "company", // an employer they've worked at (canonical, for exact-match)
  "school", // a school they attended (canonical, for exact-match)
  "industry", // domain they operate in
  "interest", // what they care about
  "offer", // how they can help others
  "need", // standing thing they're looking for
] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export interface Member {
  id: string;
  name: string;
  headline: string;
  bio: string;
  karma: number;
  is_synthetic: boolean;
  created_at: string;
}

export interface Attribute {
  id: string;
  member_id: string;
  type: AttributeType;
  value: string;
  tag: string; // normalized lowercase key for overlap matching
  weight: number;
}

export interface Ask {
  id: string;
  member_id: string;
  text: string;
  tags: string; // json string[]
  status: "open" | "matched" | "closed";
  created_at: string;
}

export interface Connection {
  id: string;
  from_member: string;
  to_member: string;
  reason: string;
  ask_id: string | null;
  created_at: string;
}

export interface KarmaEvent {
  id: string;
  member_id: string;
  delta: number;
  reason: string;
  related_member: string | null;
  created_at: string;
}

// ---- AI structured outputs ----

export const ProfileExtraction = z.object({
  name: z.string().describe("the person's full name"),
  headline: z.string().describe("a short one-line professional headline"),
  bio: z.string().describe("a 1-2 sentence summary in third person"),
  attributes: z
    .array(
      z.object({
        type: z.enum(ATTRIBUTE_TYPES),
        value: z.string(),
      }),
    )
    .describe("everything we learned about this person"),
});
export type ProfileExtraction = z.infer<typeof ProfileExtraction>;

export const NeedParse = z.object({
  summary: z.string().describe("a crisp restatement of what they need"),
  tags: z.array(z.string()).describe("normalized lowercase search tags"),
  desired_attribute_types: z.array(z.enum(ATTRIBUTE_TYPES)),
});
export type NeedParse = z.infer<typeof NeedParse>;

export const MatchRanking = z.object({
  matches: z.array(
    z.object({
      member_id: z.string(),
      score: z.number().describe("0-100 fit score"),
      reason: z.string().describe("why this person can help, specific"),
    }),
  ),
});
export type MatchRanking = z.infer<typeof MatchRanking>;
