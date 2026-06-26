import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentMemberId } from "@/lib/session";
import { getMember } from "@/lib/store/repo";
import CredBadge from "@/components/CredBadge";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Weave: autonomous networking",
  description:
    "An agentic networking community. Build your node, earn karma, and let your agent connect you to the people who can help.",
};

async function Nav() {
  const id = await getCurrentMemberId();
  const me = id ? await getMember(id) : undefined;
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
      <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="text-[var(--accent)]">✦</span> Weave
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/ask" className="hidden sm:block px-3 py-1.5 rounded-lg hover:bg-[var(--accent-soft)]">
            Ask
          </Link>
          <Link href="/community" className="hidden sm:block px-3 py-1.5 rounded-lg hover:bg-[var(--accent-soft)]">
            Community
          </Link>
          {me ? (
            <Link
              href="/home"
              className="ml-1 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--accent-soft)]"
            >
              <CredBadge karma={me.karma} size="sm" />
              <span className="font-medium hidden sm:inline">{me.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link href="/onboard" className="btn btn-primary ml-1 !py-1.5 !px-3 text-sm whitespace-nowrap">
              Join the network
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
