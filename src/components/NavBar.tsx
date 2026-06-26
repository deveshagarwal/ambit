"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import CredBadge from "@/components/CredBadge";
import Logo from "@/components/Logo";

// The landing hero is full-bleed, so the nav is hidden there. Every other page
// gets the solid top bar. signedIn (from Clerk, server-computed) drives the auth
// controls; me is the linked Ambit member (may be null right after sign-up).
export default function NavBar({
  signedIn,
  me,
}: {
  signedIn: boolean;
  me: { name: string; karma: number } | null;
}) {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
      <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Logo size={20} className="text-[var(--accent)]" /> Ambit
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/ask" className="hidden sm:block px-3 py-1.5 rounded-lg hover:bg-[var(--accent-soft)]">
            Ask
          </Link>
          <Link href="/community" className="hidden sm:block px-3 py-1.5 rounded-lg hover:bg-[var(--accent-soft)]">
            Community
          </Link>

          {signedIn ? (
            <>
              {me ? (
                <Link
                  href="/home"
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--accent-soft)]"
                >
                  <CredBadge karma={me.karma} size="sm" />
                  <span className="font-medium hidden sm:inline">{me.name.split(" ")[0]}</span>
                </Link>
              ) : (
                <Link href="/onboard" className="btn btn-primary !py-1.5 !px-3 text-sm whitespace-nowrap">
                  Finish setup
                </Link>
              )}
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--accent-soft)] font-medium">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/onboard">
                <button className="btn btn-primary !py-1.5 !px-3 text-sm whitespace-nowrap">
                  Join the network
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
