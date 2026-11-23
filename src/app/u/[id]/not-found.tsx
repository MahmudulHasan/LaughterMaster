import Link from "next/link";

import { secondaryButton } from "@/components/buttonStyles";

export default function ProfileNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        This profile isn&apos;t available
      </h1>
      <p className="mt-3 text-black/70">
        The member may not exist, or their profile was removed.
      </p>
      <Link href="/jokes" className={`${secondaryButton} mt-6`}>
        Browse all jokes
      </Link>
    </main>
  );
}
