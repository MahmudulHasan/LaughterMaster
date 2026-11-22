import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page", () => {
  it("shows the site name in the header", () => {
    render(<Home />);
    const banner = screen.getByRole("banner");
    expect(banner).toHaveTextContent("LaughterMaster");
  });

  it("shows the Top 10 of the day heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Top 10 of the day" }),
    ).toBeInTheDocument();
  });

  it("says jokes are coming soon", () => {
    render(<Home />);
    expect(screen.getByText(/jokes are coming soon/i)).toBeInTheDocument();
  });
});
