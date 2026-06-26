import { addKarma } from "./store/repo";

export const KARMA = {
  JOIN: 10, // built a profile, contributed knowledge to the graph
  HELPER: 15, // you were connected to help someone
  ASKER: 2, // you engaged the community with a real ask
} as const;

export async function awardJoin(memberId: string): Promise<void> {
  await addKarma(memberId, KARMA.JOIN, "Joined Weave and shared your knowledge");
}

export async function awardConnection(helperId: string, askerId: string): Promise<void> {
  await addKarma(helperId, KARMA.HELPER, "Connected to help a member", askerId);
  await addKarma(askerId, KARMA.ASKER, "Asked the community for help", helperId);
}
