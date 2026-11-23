// Votes, ranking and author stats for M4 (SPEC US-8, US-9, US-10).
// Every function takes the `Db` so tests can pass an in-memory database.

import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, users, votes } from "../db/schema";
import { selectViews, toView } from "./queries";
import {
  TOP_JOKES_SIZE,
  type JokeView,
  type MyJokeStats,
  type RankedJoke,
  type TopJokes,
  type VoteResult,
  type VoteValue,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MY_JOKES_LIMIT = 200;

/**
 * Click Like (1) or Dislike (-1) on a joke (US-8). Clicking the button that
 * matches your current vote removes it; the other button switches it.
 * Only approved jokes by members in good standing can be voted on, and
 * never your own.
 */
export async function castVote(
  db: Db,
  input: { jokeId: string; userId: string; value: VoteValue; now?: Date },
): Promise<VoteResult> {
  const [voter] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!voter || voter.isBanned) return { ok: false, error: "not_signed_in" };

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

  const key = and(
    eq(votes.jokeId, input.jokeId),
    eq(votes.userId, input.userId),
  );
  const [existing] = await db
    .select({ value: votes.value })
    .from(votes)
    .where(key)
    .limit(1);
  if (existing?.value === input.value) {
    await db.delete(votes).where(key);
    return { ok: true, myVote: null };
  }

  const now = input.now ?? new Date();
  await db
    .insert(votes)
    .values({
      jokeId: input.jokeId,
      userId: input.userId,
      value: input.value,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [votes.jokeId, votes.userId],
      set: { value: input.value, updatedAt: now },
    });
  return { ok: true, myVote: input.value };
}

/**
 * Attach the viewer's own vote to each joke (`myVote`). Visitors get the
 * jokes back unchanged; other members' votes are never exposed.
 */
export async function withMyVotes<T extends JokeView>(
  db: Db,
  viewerId: string | null,
  list: T[],
): Promise<T[]> {
  if (!viewerId || list.length === 0) return list;
  const rows = await db
    .select({ jokeId: votes.jokeId, value: votes.value })
    .from(votes)
    .where(
      and(
        eq(votes.userId, viewerId),
        inArray(
          votes.jokeId,
          list.map((j) => j.id),
        ),
      ),
    );
  const mine = new Map(rows.map((r) => [r.jokeId, r.value as VoteValue]));
  return list.map((j) => ({ ...j, myVote: mine.get(j.id) ?? null }));
}

type Tally = { likes: number; dislikes: number };

async function tallies(db: Db, jokeIds: string[]): Promise<Map<string, Tally>> {
  if (jokeIds.length === 0) return new Map();
  const rows = await db
    .select({
      jokeId: votes.jokeId,
      likes: sql<number>`count(*) filter (where ${votes.value} = 1)::int`,
      dislikes: sql<number>`count(*) filter (where ${votes.value} = -1)::int`,
    })
    .from(votes)
    .where(inArray(votes.jokeId, jokeIds))
    .groupBy(votes.jokeId);
  return new Map(
    rows.map((r) => [r.jokeId, { likes: r.likes, dislikes: r.dislikes }]),
  );
}

export type ScoredJoke = { joke: JokeView; likes: number; dislikes: number };

/**
 * Ranking order (US-10): higher score (likes − dislikes) first; ties go to
 * more total votes, then the earlier post (so copycats can't win ties), then
 * id for a stable order.
 */
export function compareScored(a: ScoredJoke, b: ScoredJoke): number {
  const score = b.likes - b.dislikes - (a.likes - a.dislikes);
  if (score !== 0) return score;
  const total = b.likes + b.dislikes - (a.likes + a.dislikes);
  if (total !== 0) return total;
  const time = Date.parse(a.joke.createdAt) - Date.parse(b.joke.createdAt);
  if (time !== 0) return time;
  return a.joke.id < b.joke.id ? -1 : a.joke.id > b.joke.id ? 1 : 0;
}

/**
 * Pure ranking (US-10). Today = posted within the last rolling 24 hours.
 * If fewer than 10 qualify, fill the rest with the best jokes posted 1–7
 * days ago ("From this week"). Ranks continue across both lists.
 */
export function rankJokes(candidates: ScoredJoke[], now: Date): TopJokes {
  const t = now.getTime();
  const age = (s: ScoredJoke) => t - Date.parse(s.joke.createdAt);
  const today = candidates
    .filter((s) => age(s) >= 0 && age(s) < DAY_MS)
    .sort(compareScored)
    .slice(0, TOP_JOKES_SIZE);
  const week = candidates
    .filter((s) => age(s) >= DAY_MS && age(s) < WEEK_MS)
    .sort(compareScored)
    .slice(0, TOP_JOKES_SIZE - today.length);
  const ranked = (list: ScoredJoke[], offset: number): RankedJoke[] =>
    list.map((s, i) => ({ ...s.joke, rank: offset + i + 1 }));
  return { today: ranked(today, 0), week: ranked(week, today.length) };
}

/**
 * The home page ranking (US-10). Eligible: approved, not by JokeBot, author
 * not banned, posted within the last 7 days (today plus the fill window).
 */
export async function getTopJokes(
  db: Db,
  now: Date = new Date(),
): Promise<TopJokes> {
  const rows = await selectViews(db).where(
    and(
      eq(jokes.status, "approved"),
      eq(jokes.isBot, false),
      eq(users.isBanned, false),
      gt(jokes.createdAt, new Date(now.getTime() - WEEK_MS)),
    ),
  );
  const counts = await tallies(
    db,
    rows.map((r) => r.id),
  );
  const scored = rows.map((row) => {
    const tally = counts.get(row.id) ?? { likes: 0, dislikes: 0 };
    return { joke: toView(row), ...tally };
  });
  return rankJokes(scored, now);
}

/**
 * The author's private stats (US-9): their approved and pending jokes,
 * newest first, with likes, dislikes and score. Only for the author.
 */
export async function getMyJokeStats(
  db: Db,
  userId: string,
): Promise<MyJokeStats[]> {
  const rows = await selectViews(db)
    .where(
      and(
        eq(jokes.authorId, userId),
        inArray(jokes.status, ["approved", "pending"]),
      ),
    )
    .orderBy(desc(jokes.createdAt), desc(jokes.id))
    .limit(MY_JOKES_LIMIT);
  const counts = await tallies(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((row) => {
    const { likes, dislikes } = counts.get(row.id) ?? {
      likes: 0,
      dislikes: 0,
    };
    return { ...toView(row), likes, dislikes, score: likes - dislikes };
  });
}
