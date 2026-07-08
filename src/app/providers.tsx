"use client";

import Link from "next/link";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { stoneTheme } from "@astryxdesign/theme-stone";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={stoneTheme}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
