// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { fetchWebJoke, WEB_JOKE_MAX_LENGTH } from "./fetchWebJoke";

function respond(body: unknown, init: ResponseInit = { status: 200 }) {
  return vi.fn(async () =>
    typeof body === "string"
      ? new Response(body, init)
      : Response.json(body, init),
  );
}

describe("fetchWebJoke (US-19)", () => {
  it("returns the joke text and a link to it on icanhazdadjoke", async () => {
    const fetchImpl = respond({
      id: "R7UfaahVfFd",
      joke: "  My dog used to chase people on a bike. I had to take his bike away.  ",
      status: 200,
    });
    expect(await fetchWebJoke(fetchImpl)).toEqual({
      id: "R7UfaahVfFd",
      text: "My dog used to chase people on a bike. I had to take his bike away.",
      url: "https://icanhazdadjoke.com/j/R7UfaahVfFd",
    });
  });

  it("asks for JSON and identifies the site, as the API requests", async () => {
    const fetchImpl = respond({ id: "a", joke: "A joke here.", status: 200 });
    await fetchWebJoke(fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://icanhazdadjoke.com/");
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("User-Agent")).toMatch(/^LaughterMaster \(https:\/\//);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["an error status", respond({ message: "down" }, { status: 503 })],
    ["HTML instead of JSON", respond("<html>oops</html>")],
    ["a missing joke", respond({ id: "a", status: 200 })],
    ["an empty joke", respond({ id: "a", joke: "   ", status: 200 })],
    [
      "a joke that's too long",
      respond({ id: "a", joke: "x".repeat(WEB_JOKE_MAX_LENGTH + 1) }),
    ],
    ["an id that isn't a plain slug", respond({ id: "../x", joke: "A joke." })],
  ])("returns null for %s", async (_label, fetchImpl) => {
    expect(await fetchWebJoke(fetchImpl)).toBeNull();
  });

  it("returns null when the request fails or times out", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    expect(await fetchWebJoke(fetchImpl)).toBeNull();
  });
});
