import Link from "next/link";

import { primaryButton } from "@/components/buttonStyles";

/**
 * Shown for unknown, deleted, hidden or unapproved jokes (US-6), with a
 * noindex tag; the status stays 200 under Cache Components (SPEC D16).
 */
export default function JokeNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">
        This joke isn&apos;t available
      </h1>
      <p className="text-black/70">
        It may have been deleted, or the link may be wrong.
      </p>
      <Link href="/" className={primaryButton}>
        See today&apos;s top 10
      </Link>
    </main>
  );
}
