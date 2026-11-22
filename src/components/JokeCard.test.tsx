import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { JokeListItem } from "@/lib/joke-list-item";

import { JokeCard } from "./JokeCard";

const now = new Date("2026-11-22T12:00:00Z");
const joke: JokeListItem = {
  id: "j1",
  text: "A joke under review",
  category: null,
  isBot: false,
  createdAt: now.toISOString(),
  author: { id: "dev-mina", displayName: "Mina Park", avatarUrl: null },
};

describe("JokeCard", () => {
  it("marks a pending joke Under review and explains it", () => {
    render(<JokeCard joke={joke} now={now} underReview />);
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We're checking your joke. It'll appear publicly shortly.",
      ),
    ).toBeInTheDocument();
    // Not public yet, so no link to a joke page that would say "not available".
    expect(screen.queryByRole("link", { name: /open this joke/ })).toBeNull();
  });

  it("shows the AI badge for JokeBot's jokes", () => {
    render(<JokeCard joke={{ ...joke, isBot: true }} now={now} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("renders extra actions such as Delete", () => {
    render(
      <JokeCard joke={joke} now={now} actions={<button>Delete</button>} />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
