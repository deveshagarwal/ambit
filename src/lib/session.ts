import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getMember, getMemberByClerkId } from "./store/repo";

// Demo "act as" override (used by the community sandbox). When set, it lets you
// impersonate a SEEDED member so the demo loop is explorable without an account.
// It is deliberately powerless against real accounts: the override is only
// honored when the sandbox is enabled AND the target member is synthetic.
const COOKIE = "ambit_actas";

// The demo sandbox (act-as picker, reseed) is off unless explicitly enabled.
// Keep it off in production so nobody can impersonate members or wipe the seed.
export function sandboxEnabled(): boolean {
  return process.env.AMBIT_SANDBOX === "1";
}

export async function getCurrentMemberId(): Promise<string | null> {
  if (sandboxEnabled()) {
    const store = await cookies();
    const override = store.get(COOKIE)?.value;
    if (override) {
      const m = await getMember(override);
      if (m?.is_synthetic) return override;
    }
  }

  const { userId } = await auth();
  if (!userId) return null;
  const member = await getMemberByClerkId(userId);
  return member?.id ?? null;
}

export async function setCurrentMember(id: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearCurrentMember(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
