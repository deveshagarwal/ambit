"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";

// The small inline "Sign up" link (for people who already have an invite code).
// Rendered as plain inline text, NOT a filled button — the caller styles it via
// className. Signed out it opens Clerk's hosted sign-up (redirect, not modal, so
// it still works when the Clerk instance hasn't authorized the current domain);
// signed in it's just a link into the app.
export default function JoinCTA({
  signedIn,
  href,
  label,
  className,
}: {
  signedIn: boolean;
  href: string;
  label: string;
  className?: string;
}) {
  if (signedIn) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <SignUpButton forceRedirectUrl="/onboard">
      <button type="button" className={className}>
        {label}
      </button>
    </SignUpButton>
  );
}
