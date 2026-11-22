import Link from "next/link";

import { primaryButton } from "@/components/buttonStyles";

/** Unknown or banned members (US-18); noindex, status 200 per D16. */
export default function ProfileNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">
        This profile isn&apos;t available
      </h1>
      <p className="text-black/70">
        The member may not exist, or the link may be wrong.
      </p>
      <Link href="/jokes" className={primaryButton}>
        Browse all jokes
      </Link>
    </main>
  );
}
