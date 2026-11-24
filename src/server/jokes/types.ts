// Shared jokes contracts for M3 (SPEC US-4, US-5, US-6, US-7, US-18).
// The data, post and lists teammates all build against this file, so change
// it only after agreeing with the team. It is client-safe: no server imports.

import type { PublicUser } from "../auth/types";

/** Lifecycle from SPEC §6. Only "approved" is public. */
export type JokeStatus =
  "pending" | "approved" | "rejected" | "hidden" | "removed" | "deleted";

/** SPEC US-4 / D7 / D8 and US-7 / D12. */
export const JOKE_MIN_LENGTH = 10;
export const JOKE_MAX_LENGTH = 500;
export const POSTS_PER_DAY = 10;
export const PAGE_SIZE = 20;

/** A joke as pages and APIs show it. Never includes vote counts or email. */
export type JokeView = {
  id: string;
  text: string;
  status: JokeStatus;
  author: PublicUser;
  /** ISO 8601. */
  createdAt: string;
  isBot: boolean;
  /** Assigned by Claude in M5; null until then. */
  category: string | null;
  /**
   * The signed-in viewer's own vote (US-8), when the caller attached it.
   * Never anyone else's vote, and never counts (intent #5).
   */
  myVote?: VoteValue | null;
};

/** Like = 1, dislike = -1 (US-8). */
export type VoteValue = 1 | -1;

export type VoteError = "not_signed_in" | "not_found" | "own_joke";

export type VoteResult =
  { ok: true; myVote: VoteValue | null } | { ok: false; error: VoteError };

/** One entry in the home page ranking (US-10). */
export type RankedJoke = JokeView & { rank: number };

/** The home page: today's ranked jokes, then the "From this week" fill. */
export type TopJokes = { today: RankedJoke[]; week: RankedJoke[] };

/** A row on the author's private "My jokes" page (US-9). */
export type MyJokeStats = JokeView & {
  likes: number;
  dislikes: number;
  score: number;
};

export const TOP_JOKES_SIZE = 10;

/** One batch of a lazily loaded list. `nextCursor` is null at the end. */
export type JokePage = {
  jokes: JokeView[];
  nextCursor: string | null;
};

export type CreateJokeError =
  | "not_signed_in"
  | "too_short"
  | "too_long"
  | "rate_limited"
  | "duplicate"
  | "rejected";

export type CreateJokeResult =
  | { ok: true; joke: JokeView }
  | {
      ok: false;
      error: CreateJokeError;
      /** For "rate_limited": ISO time when the member can post again. */
      retryAt?: string;
      /** For "duplicate": id of the existing joke it repeats (US-13). */
      duplicateOf?: string;
      /** For "rejected": short, kind reason in English (US-11). */
      reason?: string;
    };

/** The fixed category list (US-12, D9). Names stay in English. */
export const JOKE_CATEGORIES = [
  "Puns",
  "Dad jokes",
  "One-liners",
  "Tech",
  "Animals",
  "Wordplay",
  "Knock-knock",
  "Other",
] as const;

export type JokeCategory = (typeof JOKE_CATEGORIES)[number];

/** Header data for a member profile (US-18). */
export type ProfileView = {
  user: PublicUser;
  /** ISO 8601. */
  joinedAt: string;
  approvedJokeCount: number;
};

/**
 * Joke length as people see it: Unicode grapheme clusters of the trimmed
 * text, so emoji and non-Latin scripts count fairly (D7).
 */
export function jokeLength(text: string): number {
  const trimmed = text.trim();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(trimmed)).length;
}
