import { notFound } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { primaryButton, secondaryButton } from "@/components/buttonStyles";
import { JokeCard } from "@/components/jokes/JokeCard";
import {
  banUserAction,
  removeJokeFromQueueAction,
  restoreJokeAction,
} from "@/server/admin/actions";
import { listModerationQueue, type QueueItem } from "@/server/admin/queries";
import { isAdmin } from "@/server/auth/admin";
import { getReadyDb } from "@/server/db/ready";

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B4400C] px-4 font-semibold text-white hover:bg-[#963508] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

function Why({ item }: { item: QueueItem }) {
  if (item.status === "hidden") {
    const reasons = Object.entries(item.reportReasons)
      .map(([reason, n]) => `${reason} ${n}`)
      .join(", ");
    return (
      <p className="text-sm">
        <span className="mr-2 rounded-full bg-[#FDF0EA] px-2 py-0.5 font-semibold text-[#7A2B08]">
          Hidden
        </span>
        Reported by {item.reportCount}{" "}
        {item.reportCount === 1 ? "member" : "members"}
        {reasons && ` (${reasons})`}
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span className="mr-2 rounded-full bg-[#FFF1D6] px-2 py-0.5 font-semibold text-[#7A4B00]">
        Pending
      </span>
      Waiting for moderation
      {item.moderation.attempts > 0 &&
        ` (${item.moderation.attempts} failed ${item.moderation.attempts === 1 ? "attempt" : "attempts"})`}
    </p>
  );
}

/**
 * The admin review queue (US-16). Admins only: everyone else gets the 404
 * page. Every button posts to a server action that re-checks admin rights.
 */
export async function AdminQueue() {
  await connection();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  if (!isAdmin(viewerId)) notFound();

  const items = await listModerationQueue(await getReadyDb());
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-[#E3E5EA] bg-white p-6 text-lg">
        Nothing to review. Hidden and pending jokes will show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2">
          <Why item={item} />
          <JokeCard
            joke={item}
            linkToJoke={false}
            actions={
              <>
                <form action={restoreJokeAction}>
                  <input type="hidden" name="jokeId" value={item.id} />
                  <button type="submit" className={primaryButton}>
                    Restore
                  </button>
                </form>
                <form action={removeJokeFromQueueAction}>
                  <input type="hidden" name="jokeId" value={item.id} />
                  <button type="submit" className={secondaryButton}>
                    Remove
                  </button>
                </form>
                {!isAdmin(item.author.id) && (
                  <details className="group">
                    <summary
                      className={`${secondaryButton} cursor-pointer list-none`}
                    >
                      Ban {item.author.displayName}…
                    </summary>
                    <form
                      action={banUserAction}
                      className="mt-2 flex flex-col items-start gap-2 rounded-xl bg-[#FDF0EA] p-3 text-sm"
                    >
                      <input
                        type="hidden"
                        name="userId"
                        value={item.author.id}
                      />
                      <p>
                        They won&apos;t be able to post, vote or report, and all
                        their jokes and their profile disappear.
                      </p>
                      <button type="submit" className={dangerButton}>
                        Ban {item.author.displayName}
                      </button>
                    </form>
                  </details>
                )}
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
