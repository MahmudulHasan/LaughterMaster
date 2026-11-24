import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderShell } from "@/components/SiteHeaderShell";

import "./globals.css";

// Absolute URLs for share previews (og:url, og:image). SITE_URL wins (e.g. a
// custom domain); on Vercel it falls back to the production domain that
// Vercel provides.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
