"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Logo from "@/components/Logo";
import { Button } from "@astryxdesign/core/Button";

const STORAGE_KEY = "ambit:sidebar-collapsed";

// Perplexity-style left rail. Collapses to an icons-only strip; the choice is
// persisted in localStorage. The rail is hidden on the full-bleed landing hero
// ("/") and on the onboarding flow ("/onboard"), which is a standalone gate the
// user passes through before reaching the dashboard. signedIn (Clerk,
// server-computed) drives the auth controls; me is the linked Ambit member (may
// be null right after sign-up).
export default function Sidebar({
  signedIn,
  me,
}: {
  signedIn: boolean;
  me: { name: string; karma: number } | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Seed from localStorage after mount to avoid a hydration mismatch (no
  // localStorage on the server, so render expanded first, then reconcile).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (pathname === "/" || pathname === "/onboard") return null;

  const navItems = [
    { href: "/ask", label: "Ask", icon: <AskIcon /> },
    { href: "/community", label: "Community", icon: <CommunityIcon /> },
    { href: "/home", label: "Profile", icon: <ProfileIcon /> },
  ];

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-56"
      } shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col transition-[width] duration-200 z-20`}
    >
      {/* Top: logo + wordmark + collapse toggle */}
      <div className="h-14 flex items-center gap-2 px-3 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading font-semibold text-lg tracking-tight min-w-0"
        >
          <Logo size={20} className="text-accent shrink-0" />
          {!collapsed && <span className="truncate">Ambit</span>}
        </Link>
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto p-1.5 rounded-lg hover:bg-muted text-secondary shrink-0"
        >
          <ChevronIcon collapsed={collapsed} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 mt-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-muted text-accent"
                  : "hover:bg-muted"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: auth / profile controls */}
      <div className="mt-auto border-t border-border p-3 flex flex-col gap-2">
        {signedIn ? (
          <>
            {me ? (
              <Link
                href="/home"
                title={collapsed ? me.name : undefined}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <span className="grid place-items-center w-6 h-6 rounded-full bg-muted text-xs font-semibold shrink-0">
                  {me.name.charAt(0).toUpperCase()}
                </span>
                {!collapsed && (
                  <span className="font-medium text-sm truncate">{me.name.split(" ")[0]}</span>
                )}
              </Link>
            ) : (
              <Button
                label={collapsed ? "→" : "Finish setup"}
                href="/onboard"
                variant="primary"
                size="sm"
                tooltip={collapsed ? "Finish setup" : undefined}
                className={`w-full whitespace-nowrap ${collapsed ? "px-2" : ""}`}
              />
            )}
            <div className={collapsed ? "flex justify-center" : ""}>
              <UserButton />
            </div>
          </>
        ) : (
          <>
            {/* Hosted redirect (not modal) on purpose: the modal silently fails on
                domains the Clerk instance doesn't know about; see JoinCTA.tsx. */}
            <SignInButton forceRedirectUrl="/home">
              <Button
                label={collapsed ? "In" : "Sign in"}
                variant="ghost"
                size="sm"
                tooltip={collapsed ? "Sign in" : undefined}
                className={`w-full ${collapsed ? "" : "justify-start"}`}
              />
            </SignInButton>
            <SignUpButton forceRedirectUrl="/onboard">
              <Button
                label={collapsed ? "Join" : "Join the network"}
                variant="primary"
                size="sm"
                tooltip={collapsed ? "Join the network" : undefined}
                className={`w-full whitespace-nowrap ${collapsed ? "px-2" : ""}`}
              />
            </SignUpButton>
          </>
        )}
      </div>
    </aside>
  );
}

/* Hand-rolled inline icons (stroke currentColor, sized to match the nav text). */

function AskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
      <path d="M16 14.5a4 4 0 0 1 5 3.5v1" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
