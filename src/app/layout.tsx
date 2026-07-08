import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Playwrite_US_Trad } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import "./globals.css";
import { getCurrentMemberId } from "@/lib/session";
import { getMember } from "@/lib/store/repo";
import Sidebar from "@/components/Sidebar";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playwrite = Playwrite_US_Trad({
  variable: "--font-playwrite",
  weight: ["100", "200", "300", "400"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
    <html
      lang="en"
      className={`${dmSans.variable} ${playwrite.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={
        {
          "--font-family-body": "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
          "--font-family-heading": "var(--font-playwrite), ui-serif, serif",
          "--font-family-code": "var(--font-jetbrains-mono), ui-monospace, monospace",
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen flex">
        <ClerkProvider afterSignOutUrl="/">
          <Providers>
            <Sidebar signedIn={!!userId} me={me ? { name: me.name, karma: me.karma } : null} />
            <main className="flex-1 min-w-0 h-screen overflow-y-auto">{children}</main>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
