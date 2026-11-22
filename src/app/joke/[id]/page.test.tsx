import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicJoke, type PublicJoke } from "@/server/jokes/read";

import JokeNotFound from "./not-found";
import { JokeBody } from "./page";

vi.mock("@/server/db/app-db", () => ({ getAppDb: vi.fn() }));
vi.mock("@/server/jokes/read", () => ({ getPublicJoke: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const mockGet = getPublicJoke as unknown as ReturnType<typeof vi.fn>;
const params = (id: string) => Promise.resolve({ id });

const joke: PublicJoke = {
  id: "j1",
  text: "I told my suitcase there's no vacation this year.",
  category: "Puns",
  isBot: false,
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  author: { id: "dev-priya", displayName: "Priya S.", avatarUrl: null },
};

describe("/joke/[id]", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows the joke, category, author linked to their profile, and post time", async () => {
    mockGet.mockResolvedValue(joke);
    render(await JokeBody({ params: params("j1") }));

    expect(mockGet.mock.calls[0]?.[1]).toBe("j1");
    expect(screen.getByText(joke.text)).toBeInTheDocument();
    expect(screen.getByText("Puns")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Priya S\./ })).toHaveAttribute(
      "href",
      "/u/dev-priya",
    );
    expect(screen.getByText("3h ago")).toHaveAttribute(
      "dateTime",
      joke.createdAt.toISOString(),
    );
  });

  it("omits the category chip until moderation sets one", async () => {
    mockGet.mockResolvedValue({ ...joke, category: null });
    render(await JokeBody({ params: params("j1") }));
    expect(screen.queryByText("Puns")).toBeNull();
  });

  it("calls notFound for a joke that isn't public", async () => {
    mockGet.mockResolvedValue(null);
    await expect(JokeBody({ params: params("gone") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("has a friendly not-available page", () => {
    render(<JokeNotFound />);
    expect(
      screen.getByRole("heading", { name: "This joke isn't available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See today's top 10" }),
    ).toHaveAttribute("href", "/");
  });
});
