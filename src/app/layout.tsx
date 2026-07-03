import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import "./globals.css";
import { getCurrentMemberId } from "@/lib/session";
import { getMember } from "@/lib/store/repo";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE = "https://getambit.vercel.app";
const DESCRIPTION =
  "Autonomous networking. Set up once and your agent works the network for you, day and night, connecting you to the person who can help.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Ambit: autonomous networking",
  description: DESCRIPTION,
  openGraph: {
    title: "Ambit: your network, on autopilot",
    description: DESCRIPTION,
    url: SITE,
    siteName: "Ambit",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ambit: your network, on autopilot",
    description: DESCRIPTION,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { userId } = await auth();
  const id = await getCurrentMemberId();
  const me = id ? await getMember(id) : undefined;
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-screen flex">
          <Sidebar signedIn={!!userId} me={me ? { name: me.name, karma: me.karma } : null} />
          <main className="flex-1 min-w-0 h-screen overflow-y-auto">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
