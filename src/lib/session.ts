import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getMemberByClerkId } from "./store/repo";

// Demo "act as" override (used by the community sandbox). When set, it wins so
// you can impersonate a seeded member. Otherwise identity comes from Clerk.
const COOKIE = "ambit_actas";

export async function getCurrentMemberId(): Promise<string | null> {
  const store = await cookies();
  const override = store.get(COOKIE)?.value;
  if (override) return override;

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
