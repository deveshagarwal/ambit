import { cookies } from "next/headers";

const COOKIE = "weave_member";

export async function getCurrentMemberId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
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
