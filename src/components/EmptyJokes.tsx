import Link from "next/link";

import { primaryButton } from "./buttonStyles";

/** Shown when there are no approved jokes yet (US-7; the home page in M4). */
export function EmptyJokes() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white px-6 py-12 text-center">
      <p className="text-xl font-extrabold">No jokes yet</p>
      <p className="text-black/65">Be the first to make people laugh.</p>
      <Link href="/post" className={primaryButton}>
        Post a joke
      </Link>
    </div>
  );
}
