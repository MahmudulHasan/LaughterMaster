import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JokeCard } from "./JokeCard";
import { formatRelativeTime } from "./RelativeTime";
import { makeJoke } from "./testFixtures";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("JokeCard", () => {
  it("links the author to their profile and the time to the joke page", () => {
    render(
      <JokeCard
        joke={makeJoke(1, {
          id: "abc",
          author: { id: "u-7", displayName: "Priya", avatarUrl: null },
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /Priya/ })).toHaveAttribute(
      "href",
      "/u/u-7",
    );
    const time = screen.getByText((_, el) => el?.tagName === "TIME");
    expect(time.closest("a")).toHaveAttribute("href", "/joke/abc");
    expect(time).toHaveAttribute(
      "dateTime",
      makeJoke(1, { id: "abc" }).createdAt,
    );
  });

  it("shows the joke text, preserving line breaks", () => {
    render(<JokeCard joke={makeJoke(1, { text: "Line one\nLine two" })} />);
    const text = screen.getByText(/Line one/);
    expect(text).toHaveClass("whitespace-pre-line");
    expect(text.textContent).toBe("Line one\nLine two");
  });

  it("shows the AI badge only for JokeBot jokes", () => {
    const { rerender } = render(
      <JokeCard joke={makeJoke(1, { isBot: true })} />,
    );
    expect(screen.getByText("AI joke")).toBeInTheDocument();
    rerender(<JokeCard joke={makeJoke(1)} />);
    expect(screen.queryByText("AI joke")).not.toBeInTheDocument();
  });

  it("shows the category chip when set and Under review for pending jokes", () => {
    render(
      <JokeCard joke={makeJoke(1, { category: "Puns", status: "pending" })} />,
    );
    expect(screen.getByText("Puns")).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });

  it("omits the time link on the joke page and renders an actions slot", () => {
    render(
      <JokeCard
        joke={makeJoke(1)}
        linkToJoke={false}
        actions={<button>Share</button>}
      />,
    );
    expect(screen.queryByRole("link", { name: /ago|just now|,/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("never shows an email or vote counts, even if the data carries them", () => {
    const leaky = {
      ...makeJoke(1),
      email: "mina@example.com",
      likes: 12,
      dislikes: 3,
    };
    const { container } = render(<JokeCard joke={leaky} />);
    expect(container.textContent).not.toContain("mina@example.com");
    expect(container.textContent).not.toMatch(/\b12\b|likes|dislikes/i);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5 minutes ago"],
    [3 * 3_600_000, "3 hours ago"],
    [26 * 3_600_000, "yesterday"],
    [4 * 86_400_000, "4 days ago"],
    [-30_000, "just now"],
  ])("%d ms ago → %s", (ms, expected) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(expected);
  });
  it("uses an absolute date after a week", () => {
    expect(formatRelativeTime("2026-03-03T10:00:00.000Z", now)).toBe(
      "Mar 3, 2026",
    );
  });
});
