import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import "./globals.css";
import { getCurrentMemberId } from "@/lib/session";
import { getMember } from "@/lib/store/repo";
import NavBar from "@/components/NavBar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ambit: autonomous networking",
  description:
    "Autonomous networking. Build your persona, let your agent work the network for you, and earn cred by helping others.",
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
        <body className="min-h-full flex flex-col">
          <NavBar signedIn={!!userId} me={me ? { name: me.name, karma: me.karma } : null} />
          <main className="flex-1">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
