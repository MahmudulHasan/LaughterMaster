// Moderation pipeline (SPEC US-11, US-12, US-13): finds similar existing
// jokes, asks the moderator, and applies the result to a pending joke.

import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, users } from "../db/schema";
import type { DuplicateCandidate, Moderator } from "./moderator";

/** How many similar jokes Claude compares against (US-13). */
export const CANDIDATE_LIMIT = 20;
/** How many recent published jokes are scanned for candidates. */
const CANDIDATE_POOL = 1000;
/** After this many failed calls the retry job stops trying a joke. */
export const MAX_MODERATION_ATTEMPTS = 5;

/**
 * Character trigrams of the normalized text. Works for every script,
 * including ones written without spaces between words.
 */
export function trigrams(normalized: string): Set<string> {
  const padded = ` ${normalized} `;
  const grams = new Set<string>();
  const chars = Array.from(padded);
  for (let i = 0; i + 3 <= chars.length; i++) {
    grams.add(chars.slice(i, i + 3).join(""));
  }
  return grams;
}

/** Jaccard similarity of two trigram sets, 0..1. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * The published jokes most similar to `normalizedText`, best first, for
 * Claude's near-duplicate check (US-13). Translations rarely share
 * trigrams, so they naturally aren't offered as duplicates.
 */
export async function findDuplicateCandidates(
  db: Db,
  input: { normalizedText: string; excludeId: string },
  limit = CANDIDATE_LIMIT,
): Promise<DuplicateCandidate[]> {
  const pool = await db
    .select({
      id: jokes.id,
      text: jokes.text,
      normalizedText: jokes.normalizedText,
    })
    .from(jokes)
    .innerJoin(users, eq(jokes.authorId, users.id))
    .where(
      and(
        eq(jokes.status, "approved"),
        eq(users.isBanned, false),
        ne(jokes.id, input.excludeId),
      ),
    )
    .orderBy(desc(jokes.createdAt))
    .limit(CANDIDATE_POOL);
  const target = trigrams(input.normalizedText);
  return pool
    .map((row) => ({
      row,
      score: similarity(target, trigrams(row.normalizedText)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({ id: row.id, text: row.text }));
}

export type ModerationResult =
  | { status: "approved" }
  | { status: "rejected"; reason: string; duplicateOf: string | null }
  /** Moderation couldn't run; the joke stays hidden until the retry job. */
  | { status: "pending" }
  /** The joke wasn't pending (already handled, deleted or unknown). */
  | { status: "skipped" };

/**
 * Moderate one pending joke and store the outcome (US-11). Approved jokes
 * become public with a category; rejected ones keep their reason for the
 * audit trail; if Claude is unavailable the joke stays pending.
 */
export async function moderatePendingJoke(
  db: Db,
  jokeId: string,
  moderator: Moderator,
  now: Date = new Date(),
): Promise<ModerationResult> {
  const [joke] = await db
    .select({
      id: jokes.id,
      text: jokes.text,
      normalizedText: jokes.normalizedText,
      status: jokes.status,
    })
    .from(jokes)
    .where(eq(jokes.id, jokeId))
    .limit(1);
  if (!joke || joke.status !== "pending") return { status: "skipped" };

  const candidates = await findDuplicateCandidates(db, {
    normalizedText: joke.normalizedText,
    excludeId: joke.id,
  });
  const outcome = await moderator.moderateJoke({ text: joke.text, candidates });
  // Only update a joke that is still pending (it may have been deleted
  // while Claude was thinking).
  const stillPending = and(eq(jokes.id, joke.id), eq(jokes.status, "pending"));

  if (outcome.kind === "unavailable") {
    await db
      .update(jokes)
      .set({
        moderationAttempts: sql`${jokes.moderationAttempts} + 1`,
        updatedAt: now,
      })
      .where(stillPending);
    console.warn(
      `Moderation unavailable for joke ${joke.id}: ${outcome.error}`,
    );
    return { status: "pending" };
  }

  const { verdict, model } = outcome;
  if (verdict.decision === "approve") {
    await db
      .update(jokes)
      .set({
        status: "approved",
        category: verdict.category,
        moderationDecision: model === "dev-skip" ? "skipped" : "approved",
        moderationReason: null,
        moderationModel: model,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(stillPending);
    return { status: "approved" };
  }

  await db
    .update(jokes)
    .set({
      status: "rejected",
      category: verdict.category,
      moderationDecision: "rejected",
      moderationReason: verdict.reason,
      moderationModel: model,
      moderatedAt: now,
      duplicateOf: verdict.duplicateOf,
      updatedAt: now,
    })
    .where(stillPending);
  return {
    status: "rejected",
    reason: verdict.reason,
    duplicateOf: verdict.duplicateOf,
  };
}

/**
 * The retry job (US-11): moderate pending jokes, oldest first, skipping
 * ones that already failed `MAX_MODERATION_ATTEMPTS` times. Returns how
 * many ended in each state.
 */
export async function moderatePendingJokes(
  db: Db,
  moderator: Moderator,
  options: { limit?: number; now?: Date } = {},
): Promise<Record<ModerationResult["status"], number>> {
  const pending = await db
    .select({ id: jokes.id })
    .from(jokes)
    .where(
      and(
        eq(jokes.status, "pending"),
        lt(jokes.moderationAttempts, MAX_MODERATION_ATTEMPTS),
      ),
    )
    .orderBy(asc(jokes.createdAt))
    .limit(options.limit ?? 50);
  const counts = { approved: 0, rejected: 0, pending: 0, skipped: 0 };
  for (const { id } of pending) {
    const result = await moderatePendingJoke(db, id, moderator, options.now);
    counts[result.status]++;
  }
  return counts;
}
