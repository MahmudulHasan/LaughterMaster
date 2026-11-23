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
};

/** One batch of a lazily loaded list. `nextCursor` is null at the end. */
export type JokePage = {
  jokes: JokeView[];
  nextCursor: string | null;
};

export type CreateJokeError =
  "not_signed_in" | "too_short" | "too_long" | "rate_limited";

export type CreateJokeResult =
  | { ok: true; joke: JokeView }
  | {
      ok: false;
      error: CreateJokeError;
      /** For "rate_limited": ISO time when the member can post again. */
      retryAt?: string;
    };

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
