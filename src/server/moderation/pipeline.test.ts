// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type PgliteDb as Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users } from "../db/schema";
import { createJoke, normalizeJokeText } from "../jokes/queries";
import type { JokeStatus } from "../jokes/types";
import type {
  DuplicateCandidate,
  ModerationOutcome,
  Moderator,
} from "./moderator";
import {
  MAX_MODERATION_ATTEMPTS,
  findDuplicateCandidates,
  moderatePendingJoke,
  moderatePendingJokes,
  publishWithoutModeration,
  similarity,
  trigrams,
} from "./pipeline";

const NOW = new Date("2026-11-24T12:00:00.000Z");
let db: Db;

function fakeModerator(outcome: ModerationOutcome) {
  const moderateJoke = vi.fn<
    (input: {
      text: string;
      candidates: DuplicateCandidate[];
    }) => Promise<ModerationOutcome>
  >(async () => outcome);
  return {
    moderator: { moderateJoke, moderateDisplayName: vi.fn() } as Moderator,
    moderateJoke,
  };
}

const approve = (category = "Puns" as const): ModerationOutcome => ({
  kind: "verdict",
  model: "claude-opus-5-5",
  verdict: { decision: "approve", category },
});

async function addJoke(id: string, text: string, status: JokeStatus) {
  await db.insert(jokes).values({
    id,
    authorId: "mina",
    text,
    normalizedText: normalizeJokeText(text),
    status,
  });
}

async function row(id: string) {
  const [r] = await db.select().from(jokes).where(eq(jokes.id, id));
  return r!;
}

beforeEach(async () => {
  db = createDb({ inMemory: true });
  await runMigrations(db);
  await db.insert(users).values([
    {
      id: "mina",
      provider: "dev",
      providerAccountId: "mina",
      displayName: "Mina",
    },
    {
      id: "priya",
      provider: "dev",
      providerAccountId: "priya",
      displayName: "Priya",
    },
  ]);
});

afterEach(async () => {
  await db.$client.close();
});

describe("similarity", () => {
  it("scores reworded jokes higher than unrelated ones, in any script", () => {
    const a = trigrams(normalizeJokeText("Skeletons don't fight, no guts."));
    const reworded = trigrams(
      normalizeJokeText("Skeletons never fight: no guts!"),
    );
    const other = trigrams(normalizeJokeText("My cat hates the vacuum."));
    expect(similarity(a, reworded)).toBeGreaterThan(similarity(a, other));
    const bangla = trigrams(normalizeJokeText("রোগী: জি, ফ্রিজ পর্যন্ত"));
    expect(similarity(bangla, bangla)).toBe(1);
  });
});

describe("createJoke with moderation (US-11, US-13)", () => {
  it("saves new jokes as pending, never public", async () => {
    const result = await createJoke(db, {
      authorId: "mina",
      text: "A brand new joke about cheese.",
      now: NOW,
    });
    expect(result).toMatchObject({ ok: true, joke: { status: "pending" } });
  });

  it("rejects an exact duplicate of a published joke, with the original", async () => {
    await addJoke("orig", "Why don't skeletons fight? No guts.", "approved");
    const result = await createJoke(db, {
      authorId: "priya",
      text: "why don't SKELETONS fight?? no guts",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      error: "duplicate",
      duplicateOf: "orig",
    });
  });

  it("doesn't count rejected or deleted jokes as originals", async () => {
    await addJoke("gone", "Why don't skeletons fight? No guts.", "deleted");
    const result = await createJoke(db, {
      authorId: "priya",
      text: "Why don't skeletons fight? No guts.",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });
});

describe("moderatePendingJoke", () => {
  it("approves with a category and audit fields", async () => {
    await addJoke("p1", "A pending joke here", "pending");
    const { moderator } = fakeModerator(approve("Puns"));
    expect(await moderatePendingJoke(db, "p1", moderator, NOW)).toEqual({
      status: "approved",
    });
    expect(await row("p1")).toMatchObject({
      status: "approved",
      category: "Puns",
      moderationDecision: "approved",
      moderationModel: "claude-opus-5-5",
      moderatedAt: NOW,
    });
  });

  it("rejects with the reason and duplicate id", async () => {
    await addJoke("orig", "Skeletons don't fight, no guts.", "approved");
    await addJoke("p1", "Skeletons never fight: they have no guts!", "pending");
    const { moderator, moderateJoke } = fakeModerator({
      kind: "verdict",
      model: "claude-opus-5-5",
      verdict: {
        decision: "reject",
        reason: "This joke is already on LaughterMaster.",
        category: "Other",
        duplicateOf: "orig",
      },
    });
    expect(await moderatePendingJoke(db, "p1", moderator, NOW)).toEqual({
      status: "rejected",
      reason: "This joke is already on LaughterMaster.",
      duplicateOf: "orig",
    });
    // The similar published joke was offered as a candidate.
    expect(moderateJoke.mock.calls[0]![0]).toMatchObject({
      candidates: [{ id: "orig" }],
    });
    expect(await row("p1")).toMatchObject({
      status: "rejected",
      moderationReason: "This joke is already on LaughterMaster.",
      duplicateOf: "orig",
    });
  });

  it("keeps the joke pending and counts the attempt when Claude is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await addJoke("p1", "A pending joke here", "pending");
    const { moderator } = fakeModerator({
      kind: "unavailable",
      error: "timeout",
    });
    expect(await moderatePendingJoke(db, "p1", moderator, NOW)).toEqual({
      status: "pending",
    });
    expect(await row("p1")).toMatchObject({
      status: "pending",
      moderationAttempts: 1,
    });
  });

  it("marks dev-skip approvals as skipped", async () => {
    await addJoke("p1", "A pending joke here", "pending");
    const { moderator } = fakeModerator({
      kind: "verdict",
      model: "dev-skip",
      verdict: { decision: "approve", category: "Other" },
    });
    await moderatePendingJoke(db, "p1", moderator, NOW);
    expect(await row("p1")).toMatchObject({
      status: "approved",
      moderationDecision: "skipped",
    });
  });

  it("leaves non-pending jokes alone", async () => {
    await addJoke("d1", "A deleted joke here", "deleted");
    const { moderator, moderateJoke } = fakeModerator(approve());
    expect(await moderatePendingJoke(db, "d1", moderator, NOW)).toEqual({
      status: "skipped",
    });
    expect(moderateJoke).not.toHaveBeenCalled();
    expect((await row("d1")).status).toBe("deleted");
  });
});

describe("publishWithoutModeration (admin posts)", () => {
  it("publishes a pending joke and records that moderation was skipped", async () => {
    await addJoke("a1", "An admin's own joke here", "pending");
    expect(await publishWithoutModeration(db, "a1", NOW)).toEqual({
      status: "approved",
    });
    expect(await row("a1")).toMatchObject({
      status: "approved",
      category: null,
      moderationDecision: "skipped",
      moderationModel: "admin",
      moderatedAt: NOW,
    });
  });

  it("leaves jokes that aren't pending alone", async () => {
    await addJoke("d1", "A deleted joke here", "deleted");
    expect(await publishWithoutModeration(db, "d1", NOW)).toEqual({
      status: "skipped",
    });
    expect((await row("d1")).status).toBe("deleted");
  });
});

describe("findDuplicateCandidates", () => {
  it("offers only published jokes, most similar first, at most 20", async () => {
    await addJoke("close", "Skeletons don't fight, no guts.", "approved");
    await addJoke("far", "My cat hates the vacuum cleaner.", "approved");
    await addJoke("hidden", "Skeletons don't fight, no guts!", "rejected");
    for (let i = 0; i < 25; i++) {
      await addJoke(
        `filler-${i}`,
        `Skeleton joke number ${i} about fights`,
        "approved",
      );
    }
    const candidates = await findDuplicateCandidates(db, {
      normalizedText: normalizeJokeText("Skeletons never fight: no guts"),
      excludeId: "none",
    });
    expect(candidates).toHaveLength(20);
    expect(candidates[0]!.id).toBe("close");
    expect(candidates.map((c) => c.id)).not.toContain("hidden");
  });
});

describe("moderatePendingJokes (retry job)", () => {
  it("moderates pending jokes and skips ones that failed too often", async () => {
    await addJoke("p1", "First pending joke", "pending");
    await addJoke("p2", "Second pending joke", "pending");
    await db
      .update(jokes)
      .set({ moderationAttempts: MAX_MODERATION_ATTEMPTS })
      .where(eq(jokes.id, "p2"));
    const { moderator, moderateJoke } = fakeModerator(approve());
    expect(await moderatePendingJokes(db, moderator, { now: NOW })).toEqual({
      approved: 1,
      rejected: 0,
      pending: 0,
      skipped: 0,
    });
    expect(moderateJoke).toHaveBeenCalledTimes(1);
    expect((await row("p2")).status).toBe("pending");
  });
});
