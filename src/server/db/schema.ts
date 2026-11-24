// Drizzle schema for LaughterMaster, following the data model in SPEC.md §6.
// After changing a table, run `npm run db:generate` to create a migration.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { JokeStatus } from "../jokes/types";

/** Members. `email` is private and must never reach a page or API response. */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    email: text("email"),
    isBanned: boolean("is_banned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Jokes (SPEC §6). `status` drives visibility everywhere; only "approved" is
 * public. Values come from JokeStatus in src/server/jokes/types.ts.
 *
 * M3 auto-approves new jokes locally. M5 adds Claude moderation: new jokes
 * will start as "pending" and moderation fields will be added then.
 */
export const jokes = pgTable(
  "jokes",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    text: text("text").notNull(),
    /** Lowercase, punctuation removed, whitespace collapsed (M5 duplicates). */
    normalizedText: text("normalized_text").notNull(),
    // New jokes start "pending" until Claude moderates them (US-11).
    status: text("status").$type<JokeStatus>().notNull().default("pending"),
    category: text("category"),
    isBot: boolean("is_bot").notNull().default(false),
    // Moderation audit trail (US-11): what was decided, why, by which model.
    moderationDecision: text("moderation_decision").$type<
      "approved" | "rejected" | "skipped"
    >(),
    moderationReason: text("moderation_reason"),
    moderationModel: text("moderation_model"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    /** Failed moderation calls so far; the retry job gives up after a few. */
    moderationAttempts: integer("moderation_attempts").notNull().default(0),
    /** Set when rejected as a repeat of another joke (US-13). */
    duplicateOf: text("duplicate_of"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Keyset pagination for /jokes: newest first, ties broken by id.
    index("jokes_status_created_idx").on(
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // Profile lists and the per-member post rate limit.
    index("jokes_author_created_idx").on(
      table.authorId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export type Joke = typeof jokes.$inferSelect;
export type NewJoke = typeof jokes.$inferInsert;

/** One vote per member per joke (US-8): like = 1, dislike = -1. */
export const votes = pgTable(
  "votes",
  {
    jokeId: text("joke_id")
      .notNull()
      .references(() => jokes.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    value: smallint("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.jokeId, table.userId] }),
    check("votes_value_check", sql`${table.value} in (1, -1)`),
    // Ranking aggregates votes per joke.
    index("votes_joke_idx").on(table.jokeId),
  ],
);

export type Vote = typeof votes.$inferSelect;
