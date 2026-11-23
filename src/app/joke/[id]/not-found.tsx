import Link from "next/link";

import { primaryButton } from "@/components/buttonStyles";

/** Friendly 404 for unknown, hidden, or deleted jokes (US-6). */
export default function JokeNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        This joke isn&apos;t available
      </h1>
      <p className="mt-3 text-black/70">
        It may have been deleted, or the link might be wrong.
      </p>
      <Link href="/jokes" className={`${primaryButton} mt-6`}>
        Browse all jokes
      </Link>
    </main>
  );
}
