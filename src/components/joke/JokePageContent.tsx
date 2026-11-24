import { notFound } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { hasReported } from "@/server/admin/queries";
import { isAdmin } from "@/server/auth/admin";
import { getSignInOptions } from "@/server/auth/providers";
import { getReadyDb } from "@/server/db/ready";
import { getJokeForViewer } from "@/server/jokes/queries";
import { withMyVotes } from "@/server/jokes/votes";

import { JokeDetail } from "./JokeDetail";

/**
 * Request-time part of `/joke/<id>` (US-6). Reads the session, so it must
 * render inside <Suspense>. Unknown, hidden, deleted, or someone else's
 * pending joke -> notFound().
 */
export async function JokePageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const [{ id }, session] = await Promise.all([params, auth()]);
  const viewerId = session?.user?.id ?? null;
  const db = await getReadyDb();
  const found = await getJokeForViewer(db, id, viewerId);
  if (!found) notFound();
  const [joke] = await withMyVotes(db, viewerId, [found]);
  const isAuthor = viewerId === found.author.id;
  const report = isAuthor
    ? undefined
    : !viewerId
      ? ("visitor" as const)
      : (await hasReported(db, found.id, viewerId))
        ? ("reported" as const)
        : ("member" as const);
  return (
    <JokeDetail
      joke={joke ?? found}
      isAuthor={isAuthor}
      isAdmin={isAdmin(viewerId)}
      report={report}
      votes={{
        voter: !viewerId ? "visitor" : isAuthor ? "author" : "member",
        signInOptions: getSignInOptions(),
      }}
    />
  );
}
