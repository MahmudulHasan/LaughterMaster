import { z } from "zod";

// "Joke from the web" on the home page (SPEC US-19, D20): one clean dad
// joke from icanhazdadjoke.com, clearly labelled and credited. It never
// joins the community's lists or the top 10.

const API_URL = "https://icanhazdadjoke.com/";
const TIMEOUT_MS = 3000;

/** Longer jokes are skipped: the box is small and this keeps it tidy. */
export const WEB_JOKE_MAX_LENGTH = 300;

const ResponseSchema = z.object({
  // Used in a link, so only accept the API's plain slug-like ids.
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  joke: z.string(),
});

export type WebJoke = {
  id: string;
  text: string;
  /** The joke's own page on icanhazdadjoke, for credit. */
  url: string;
};

/**
 * Fetch one random joke. Any failure (slow, down, odd response, too long)
 * returns null and the home page simply leaves the box out.
 */
export async function fetchWebJoke(
  fetchImpl: typeof fetch = fetch,
): Promise<WebJoke | null> {
  try {
    const response = await fetchImpl(API_URL, {
      headers: {
        Accept: "application/json",
        // icanhazdadjoke asks every caller to identify itself.
        "User-Agent": "LaughterMaster (https://laughter-master.vercel.app)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const text = parsed.data.joke.trim();
    if (!text || Array.from(text).length > WEB_JOKE_MAX_LENGTH) return null;
    return {
      id: parsed.data.id,
      text,
      url: `https://icanhazdadjoke.com/j/${parsed.data.id}`,
    };
  } catch {
    return null;
  }
}
