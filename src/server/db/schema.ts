// Drizzle schema for LaughterMaster, following the data model in SPEC.md §6.
// After changing a table, run `npm run db:generate` to create a migration.

import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
 * Joke lifecycle (SPEC §6). Only `approved` jokes are public; the author
 * alone also sees their own `pending` ones.
 */
export const jokeStatus = pgEnum("joke_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
  "removed",
  "deleted",
]);

export type JokeStatus = (typeof jokeStatus.enumValues)[number];

export const jokes = pgTable(
  "jokes",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    /** Trimmed text exactly as the author wrote it. */
    text: text("text").notNull(),
    /** Comparison form for duplicate checks (M5). */
    normalizedText: text("normalized_text").notNull(),
    /** Set by moderation in M5. */
    category: text("category"),
    status: jokeStatus("status").notNull().default("pending"),
    moderationDecision: text("moderation_decision"),
    moderationReason: text("moderation_reason"),
    moderationModel: text("moderation_model"),
    moderationCheckedAt: timestamp("moderation_checked_at", {
      withTimezone: true,
    }),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Newest-first public lists paged by (created_at, id) cursor.
    index("jokes_status_created_idx").on(
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // Post rate limit and profile lists.
    index("jokes_author_created_idx").on(
      table.authorId,
      table.createdAt.desc(),
    ),
  ],
);

export type Joke = typeof jokes.$inferSelect;
export type NewJoke = typeof jokes.$inferInsert;
