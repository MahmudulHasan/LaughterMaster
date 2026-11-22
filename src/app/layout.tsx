import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderShell } from "@/components/SiteHeaderShell";

import "./globals.css";

export const metadata: Metadata = {
  title: "LaughterMaster",
  description: "Post jokes, vote, and see the top 10 of the day.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        {/* SiteHeader reads the session (cookies), so with cacheComponents it
            streams in behind a static header and pages stay prerenderable. */}
        <Suspense fallback={<SiteHeaderShell />}>
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
