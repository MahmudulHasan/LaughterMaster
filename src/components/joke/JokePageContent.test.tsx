import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getJokeForViewer } from "@/server/jokes/queries";
import type { JokeView } from "@/server/jokes/types";

import { JokePageContent } from "./JokePageContent";

vi.mock("@/server/jokes/votes", () => ({
  withMyVotes: async (_db: unknown, _viewer: unknown, list: unknown) => list,
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const db = { fake: "db" };
vi.mock("@/server/db/ready", () => ({ getReadyDb: async () => db }));
vi.mock("@/server/jokes/queries", () => ({ getJokeForViewer: vi.fn() }));
vi.mock("@/server/jokes/actions", () => ({ deleteJokeAction: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));

class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_HTTP_ERROR_FALLBACK;404");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  usePathname: () => "/joke/j-1",
}));

// `auth` is overloaded (it is also middleware); only the zero-arg form is used.
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGet = vi.mocked(getJokeForViewer);

const joke: JokeView = {
  id: "j-1",
  text: "I told my wifi a joke. It didn't get the connection.",
  status: "approved",
  author: { id: "u-mina", displayName: "Mina Park", avatarUrl: null },
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  isBot: false,
  category: null,
};

function asUser(id: string | null) {
  mockAuth.mockResolvedValue(
    id ? { user: { id, name: "Someone", image: null }, expires: "" } : null,
  );
}

async function renderPage(id = "j-1") {
  render(await JokePageContent({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  mockAuth.mockReset();
  mockGet.mockReset();
  notFound.mockClear();
});

describe("JokePageContent", () => {
  it("shows the joke, the linked author and the relative time to anyone", async () => {
    asUser(null);
    mockGet.mockResolvedValue(joke);
    await renderPage();
    expect(mockGet).toHaveBeenCalledWith(db, "j-1", null);
    expect(
      screen.getByRole("heading", { level: 1, name: "Joke by Mina Park" }),
    ).toHaveClass("sr-only");
    const article = screen.getByRole("article", { name: "Joke by Mina Park" });
    expect(article).toHaveTextContent(joke.text);
    expect(
      within(article).getByRole("link", { name: /Mina Park/ }),
    ).toHaveAttribute("href", "/u/u-mina");
    expect(article).toHaveTextContent("Posted 2 hours ago");
    expect(screen.getByRole("link", { name: /Back/ })).toBeInTheDocument();
    expect(
      within(article).queryByRole("button", { name: "Delete" }),
    ).toBeNull();
    expect(screen.queryByText("Under review")).toBeNull();
  });

  it("shows the category chip only when there is one", async () => {
    asUser(null);
    mockGet.mockResolvedValue({ ...joke, category: "Tech" });
    await renderPage();
    expect(screen.getByText("Tech")).toBeInTheDocument();
  });

  // getJokeForViewer returns null for unknown, deleted, hidden, rejected and
  // other members' pending jokes; the page must turn that into notFound().
  it("calls notFound() when the joke isn't visible to the viewer", async () => {
    asUser("u-other");
    mockGet.mockResolvedValue(null);
    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(db, "missing", "u-other");
  });

  it("shows Delete only to the author", async () => {
    asUser("u-other");
    mockGet.mockResolvedValue(joke);
    await renderPage();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    cleanup();

    asUser("u-mina");
    mockGet.mockResolvedValue(joke);
    await renderPage();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("marks the author's own pending joke as under review", async () => {
    asUser("u-mina");
    mockGet.mockResolvedValue({ ...joke, status: "pending" });
    await renderPage();
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/only you can see/);
  });
});
