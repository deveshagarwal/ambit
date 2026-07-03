"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

// Landing call to action. Signed out, it sends you to Clerk's hosted sign-up
// (then onboarding); signed in, it links straight to the app.
//
// Redirect (not modal) on purpose: an embedded modal requires the current domain
// to be authorized on the Clerk instance, so on a domain that isn't (e.g. a
// dev/test Clerk instance running on the production URL) the modal silently fails
// to open and the button appears dead. A redirect to the hosted portal always
// works and, if anything is misconfigured, fails visibly instead of doing nothing.
export default function JoinCTA({
  signedIn,
  href,
  label,
  className,
  size,
}: {
  signedIn: boolean;
  href: string;
  label: string;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
}) {
  if (signedIn) {
    return (
      <Button render={<Link href={href} />} size={size} className={className}>
        {label}
      </Button>
    );
  }
  return (
    <SignUpButton forceRedirectUrl="/onboard">
      <Button size={size} className={className}>
        {label}
      </Button>
    </SignUpButton>
  );
}
