import { describe, expect, it } from "vitest";

import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  POSTS_PER_DAY,
  jokeLength,
} from "../src/server/jokes/types";
import { normalizeJokeText } from "../src/server/jokes/queries";
import { buildJokeRows, SEED_JOKES, SEED_USERS } from "./seed-data";

const DAY_HOURS = 24;

describe("seed data", () => {
  it("has about 32 jokes with unique, deterministic ids", () => {
    expect(SEED_JOKES.length).toBe(32);
    const ids = SEED_JOKES.map((joke) => joke.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^seed-\d{2}$/);
  });

  it("keeps every joke within the 10–500 grapheme limit", () => {
    for (const joke of SEED_JOKES) {
      const length = jokeLength(joke.text);
      expect(length, joke.id).toBeGreaterThanOrEqual(JOKE_MIN_LENGTH);
      expect(length, joke.id).toBeLessThanOrEqual(JOKE_MAX_LENGTH);
    }
  });

  it("has no duplicate jokes after normalizing", () => {
    const normalized = SEED_JOKES.map((joke) => normalizeJokeText(joke.text));
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("only uses the dev users, and every one has several jokes", () => {
    const userIds = new Set(SEED_USERS.map((user) => user.id));
    expect(userIds).toEqual(new Set(["dev-mina", "dev-priya", "dev-admin"]));
    for (const joke of SEED_JOKES)
      expect(userIds.has(joke.authorId)).toBe(true);
    for (const id of userIds) {
      const mine = SEED_JOKES.filter((joke) => joke.authorId === id);
      expect(mine.length, id).toBeGreaterThanOrEqual(8);
    }
  });

  it("spreads jokes over the last 6 days with distinct times", () => {
    const hours = SEED_JOKES.map((joke) => joke.hoursAgo);
    expect(new Set(hours).size).toBe(hours.length);
    for (const h of hours) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(7 * DAY_HOURS);
    }
    const days = new Set(hours.map((h) => Math.floor(h / DAY_HOURS)));
    expect(days).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it("leaves each member room to post today", () => {
    for (const user of SEED_USERS) {
      const today = SEED_JOKES.filter(
        (joke) => joke.authorId === user.id && joke.hoursAgo < DAY_HOURS,
      );
      expect(today.length, user.id).toBeLessThan(POSTS_PER_DAY);
    }
  });

  it("includes multi-line, emoji and non-English jokes", () => {
    const texts = SEED_JOKES.map((joke) => joke.text);
    expect(
      texts.filter((t) => t.startsWith("Knock, knock.\n")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(texts.some((t) => /\p{Extended_Pictographic}/u.test(t))).toBe(true);
    expect(texts.some((t) => /\p{Script=Hangul}/u.test(t))).toBe(true);
    expect(texts.some((t) => /\p{Script=Devanagari}/u.test(t))).toBe(true);
    expect(texts.some((t) => /[¿ñá]/u.test(t))).toBe(true);
  });

  it("builds approved, uncategorized rows dated before now", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    const rows = buildJokeRows(now);
    expect(rows).toHaveLength(SEED_JOKES.length);
    for (const row of rows) {
      expect(row.status).toBe("approved");
      expect(row.category).toBeNull();
      expect(row.isBot).toBe(false);
      expect(row.normalizedText).toBe(normalizeJokeText(row.text));
      expect(row.createdAt!.getTime()).toBeLessThan(now.getTime());
      expect(row.updatedAt).toEqual(row.createdAt);
    }
    expect(rows[0]!.createdAt).toEqual(new Date("2026-11-23T11:30:00Z"));
  });
});
