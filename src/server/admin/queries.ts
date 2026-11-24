// Reports and the admin review queue (SPEC US-15, US-16). Every function
// takes the `Db`; callers check admin rights (src/server/auth/admin.ts).

import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, reports, users, type ReportReason } from "../db/schema";
import { selectViews, toView } from "../jokes/queries";
import type { JokeView } from "../jokes/types";

/** D3: this many different members' reports hide a joke for review. */
export const REPORTS_TO_HIDE = 5;
/** SPEC §5: reports per member per rolling 24 hours. */
export const REPORTS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportError =
  | "not_signed_in"
  | "not_found"
  | "own_joke"
  | "already_reported"
  | "rate_limited";

export type ReportResult =
  { ok: true; hidden: boolean } | { ok: false; error: ReportError };

/**
 * A member reports a published joke (US-15), once per joke and never their
 * own. The fifth different report hides the joke until an admin reviews it.
 */
export async function reportJoke(
  db: Db,
  input: { jokeId: string; userId: string; reason: ReportReason; now?: Date },
): Promise<ReportResult> {
  const now = input.now ?? new Date();
  const [reporter] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!reporter || reporter.isBanned) {
    return { ok: false, error: "not_signed_in" };
  }

  const [joke] = await db
    .select({
      authorId: jokes.authorId,
      status: jokes.status,
      authorBanned: users.isBanned,
    })
    .from(jokes)
    .innerJoin(users, eq(jokes.authorId, users.id))
    .where(eq(jokes.id, input.jokeId))
    .limit(1);
  if (!joke || joke.status !== "approved" || joke.authorBanned) {
    return { ok: false, error: "not_found" };
  }
  if (joke.authorId === input.userId) return { ok: false, error: "own_joke" };

  const [recent] = await db
    .select({ n: count() })
    .from(reports)
    .where(
      and(
        eq(reports.userId, input.userId),
        gt(reports.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    );
  if ((recent?.n ?? 0) >= REPORTS_PER_DAY) {
    return { ok: false, error: "rate_limited" };
  }

  const inserted = await db
    .insert(reports)
    .values({
      jokeId: input.jokeId,
      userId: input.userId,
      reason: input.reason,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ jokeId: reports.jokeId });
  if (inserted.length === 0) return { ok: false, error: "already_reported" };

  const [total] = await db
    .select({ n: count() })
    .from(reports)
    .where(eq(reports.jokeId, input.jokeId));
  if ((total?.n ?? 0) < REPORTS_TO_HIDE) return { ok: true, hidden: false };

  const hidden = await db
    .update(jokes)
    .set({ status: "hidden", updatedAt: now })
    .where(and(eq(jokes.id, input.jokeId), eq(jokes.status, "approved")))
    .returning({ id: jokes.id });
  return { ok: true, hidden: hidden.length > 0 };
}

/** Whether this member already reported this joke (to show "Reported"). */
export async function hasReported(
  db: Db,
  jokeId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ jokeId: reports.jokeId })
    .from(reports)
    .where(and(eq(reports.jokeId, jokeId), eq(reports.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export type QueueItem = JokeView & {
  reportCount: number;
  reportReasons: Partial<Record<ReportReason, number>>;
  moderation: {
    decision: string | null;
    reason: string | null;
    model: string | null;
    attempts: number;
  };
};

/**
 * The admin review queue (US-16): hidden jokes (reported) first, then
 * pending ones (waiting for moderation), newest first within each.
 * Jokes by banned members are left out; they're hidden anyway.
 */
export async function listModerationQueue(db: Db): Promise<QueueItem[]> {
  const rows = await selectViews(db)
    .where(
      and(
        inArray(jokes.status, ["hidden", "pending"]),
        eq(users.isBanned, false),
      ),
    )
    .orderBy(
      sql`case when ${jokes.status} = 'hidden' then 0 else 1 end`,
      desc(jokes.createdAt),
    )
    .limit(200);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const details = await db
    .select({
      id: jokes.id,
      decision: jokes.moderationDecision,
      reason: jokes.moderationReason,
      model: jokes.moderationModel,
      attempts: jokes.moderationAttempts,
    })
    .from(jokes)
    .where(inArray(jokes.id, ids));
  const byId = new Map(details.map((d) => [d.id, d]));

  const reasonRows = await db
    .select({
      jokeId: reports.jokeId,
      reason: reports.reason,
      n: count(),
    })
    .from(reports)
    .where(inArray(reports.jokeId, ids))
    .groupBy(reports.jokeId, reports.reason);
  const reasons = new Map<string, Partial<Record<ReportReason, number>>>();
  for (const r of reasonRows) {
    const entry = reasons.get(r.jokeId) ?? {};
    entry[r.reason] = r.n;
    reasons.set(r.jokeId, entry);
  }

  return rows.map((row) => {
    const d = byId.get(row.id);
    const reportReasons = reasons.get(row.id) ?? {};
    return {
      ...toView(row),
      reportCount: Object.values(reportReasons).reduce((a, b) => a + b, 0),
      reportReasons,
      moderation: {
        decision: d?.decision ?? null,
        reason: d?.reason ?? null,
        model: d?.model ?? null,
        attempts: d?.attempts ?? 0,
      },
    };
  });
}

/**
 * An admin publishes a hidden or pending joke (US-16). Its reports are
 * cleared so five new ones are needed to hide it again.
 */
export async function restoreJoke(
  db: Db,
  input: { jokeId: string; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const restored = await db
    .update(jokes)
    .set({
      status: "approved",
      moderationDecision: "approved",
      moderationModel: "admin",
      moderatedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(jokes.id, input.jokeId),
        inArray(jokes.status, ["hidden", "pending"]),
      ),
    )
    .returning({ id: jokes.id });
  if (restored.length === 0) return false;
  await db.delete(reports).where(eq(reports.jokeId, input.jokeId));
  return true;
}

/**
 * Ban a member (US-16): they can't post, vote or report, and their jokes and
 * profile disappear (every public query filters banned authors).
 */
export async function banUser(db: Db, userId: string): Promise<boolean> {
  const banned = await db
    .update(users)
    .set({ isBanned: true, updatedAt: sql`now()` })
    .where(and(eq(users.id, userId), eq(users.isBanned, false)))
    .returning({ id: users.id });
  return banned.length > 0;
}
