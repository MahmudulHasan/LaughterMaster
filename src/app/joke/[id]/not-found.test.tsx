import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import JokeNotFound from "./not-found";

describe("joke not-found page", () => {
  it("says the joke isn't available and links to all jokes", () => {
    render(<JokeNotFound />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This joke isn't available",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse all jokes" }),
    ).toHaveAttribute("href", "/jokes");
  });
});
