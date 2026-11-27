import { cacheLife } from "next/cache";

import { fetchWebJoke, type WebJoke } from "./fetchWebJoke";

/**
 * The current "Joke from the web", shared by every visitor and refreshed in
 * the background about every 15 minutes, so icanhazdadjoke gets a few
 * requests an hour instead of one per page view. A failed fetch (null) is
 * cached the same way, so an outage doesn't slow the home page.
 */
export async function getWebJoke(): Promise<WebJoke | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return fetchWebJoke();
}
