import type { PublicUser } from "@/server/auth/types";

/**
 * A joke as list components and the list API see it: JSON-safe (ISO date),
 * public fields only. Safe to import from client code.
 */
export type JokeListItem = {
  id: string;
  text: string;
  category: string | null;
  isBot: boolean;
  createdAt: string;
  author: PublicUser;
};

export type JokeListPage = {
  jokes: JokeListItem[];
  nextCursor: string | null;
};

/** Build a list item field by field, so nothing extra ever leaks through. */
export function toJokeListItem(joke: {
  id: string;
  text: string;
  category: string | null;
  isBot: boolean;
  createdAt: Date;
  author: PublicUser;
}): JokeListItem {
  return {
    id: joke.id,
    text: joke.text,
    category: joke.category,
    isBot: joke.isBot,
    createdAt: joke.createdAt.toISOString(),
    author: {
      id: joke.author.id,
      displayName: joke.author.displayName,
      avatarUrl: joke.author.avatarUrl,
    },
  };
}
