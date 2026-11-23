import { notFound } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { getReadyDb } from "@/server/db/ready";
import { getJokeForViewer } from "@/server/jokes/queries";

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
  const joke = await getJokeForViewer(db, id, viewerId);
  if (!joke) notFound();
  return <JokeDetail joke={joke} isAuthor={viewerId === joke.author.id} />;
}
