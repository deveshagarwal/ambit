import { seedCommunity } from "./seed";

let seededPromise: Promise<void> | null = null;

// Ensure the synthetic sandbox community exists. Idempotent and race-safe:
// concurrent callers on a cold start share one seeding promise.
export function ensureSeeded(): Promise<void> {
  if (!seededPromise) seededPromise = seedCommunity(false).then(() => undefined);
  return seededPromise;
}
