// Cred turns the raw karma number into legible standing in the network.
//
// The core loop: you earn cred by helping (being connected to someone who
// needs you), and cred is exactly what gets you helped back. A higher tier
// means the network leans in harder when you ask, because you have already
// shown up for it. Karma is cred is reciprocity.

export interface CredTier {
  name: string;
  // lowest karma that lands you in this tier
  min: number;
  // hex used to tint the badge, pill, and progress fill for this tier
  color: string;
  // how the network treats you at this tier, framed as reciprocity
  standing: string;
}

// Ordered low to high. Thresholds are tuned to the karma economy in karma.ts
// (JOIN 10, HELPER 15, ASKER 2): you start as a Newcomer, become a Contributor
// the moment you join, and climb mostly by helping (each help is worth 15).
export const CRED_TIERS: CredTier[] = [
  {
    name: "Newcomer",
    min: 0,
    color: "#6b6678",
    standing: "Brand new to the graph. Build your persona and make your first ask to start earning standing.",
  },
  {
    name: "Contributor",
    min: 10,
    color: "#2e9e6b",
    standing: "You are on the map. Your knowledge is in the graph, so the network can already route people to you.",
  },
  {
    name: "Connector",
    min: 30,
    color: "#5b4bdb",
    standing: "You show up for others. Members recognize your name, and your asks move toward the front of the line.",
  },
  {
    name: "Broker",
    min: 70,
    color: "#c8911f",
    standing: "A trusted node. You have helped enough that the network actively wants to repay you, and top people answer when you reach out.",
  },
  {
    name: "Pillar",
    min: 150,
    color: "#d9663b",
    standing: "The graph leans on you. Your standing opens almost any door here, because you have spent so much of yourself keeping the network alive.",
  },
];

export function credTier(karma: number): CredTier {
  // highest tier whose min is at or below the member's karma
  let current = CRED_TIERS[0];
  for (const tier of CRED_TIERS) {
    if (karma >= tier.min) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}

export function nextTier(karma: number): { tier: CredTier | null; remaining: number } {
  const current = credTier(karma);
  const currentIndex = CRED_TIERS.indexOf(current);
  const next = CRED_TIERS[currentIndex + 1];
  if (!next) {
    return { tier: null, remaining: 0 };
  }
  return { tier: next, remaining: Math.max(0, next.min - karma) };
}

// Progress through the current tier toward the next, in 0..1.
// Returns 1 when there is no next tier (top tier).
export function tierProgress(karma: number): number {
  const current = credTier(karma);
  const { tier: next } = nextTier(karma);
  if (!next) {
    return 1;
  }
  const span = next.min - current.min;
  if (span <= 0) {
    return 1;
  }
  const into = karma - current.min;
  return Math.min(1, Math.max(0, into / span));
}
