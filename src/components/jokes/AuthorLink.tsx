import Link from "next/link";

import { Avatar } from "@/components/UserMenu";
import type { PublicUser } from "@/server/auth/types";

/** Avatar + display name linking to the author's profile (US-18, D14). */
export function AuthorLink({
  author,
  size = 32,
}: {
  author: PublicUser;
  size?: number;
}) {
  return (
    <Link
      href={`/u/${encodeURIComponent(author.id)}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl font-semibold text-[#15161A] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
    >
      <Avatar
        user={{ name: author.displayName, image: author.avatarUrl }}
        size={size}
      />
      <span>{author.displayName}</span>
    </Link>
  );
}
