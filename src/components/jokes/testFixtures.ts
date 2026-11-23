import type { JokePage, JokeView } from "@/server/jokes/types";

/** A joke for tests; `n` makes ids and times unique and newest-first. */
export function makeJoke(
  n: number,
  overrides: Partial<JokeView> = {},
): JokeView {
  return {
    id: `joke-${n}`,
    text: `Joke number ${n}, with a punchline.`,
    status: "approved",
    author: { id: "user-1", displayName: "Mina Park", avatarUrl: null },
    // Higher n = older, so makeJokes(1..20) is newest first.
    createdAt: new Date(
      Date.UTC(2026, 10, 22, 12, 0, 0) - n * 60_000,
    ).toISOString(),
    isBot: false,
    category: null,
    ...overrides,
  };
}

export function makeJokes(from: number, to: number): JokeView[] {
  return Array.from({ length: to - from + 1 }, (_, i) => makeJoke(from + i));
}

export function makePage(
  from: number,
  to: number,
  nextCursor: string | null,
): JokePage {
  return { jokes: makeJokes(from, to), nextCursor };
}
