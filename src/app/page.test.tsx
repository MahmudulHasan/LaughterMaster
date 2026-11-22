import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/providers", () => ({
  getSignInOptions: () => ({ google: true, devUsers: [] }),
}));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("Home page", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue(null);
  });

  // The header comes from the root layout; render it alongside the page to
  // check what a logged-out visitor sees.
  async function renderAsVisitor() {
    const header = await SiteHeader();
    render(
      <>
        {header}
        <Home />
      </>,
    );
  }

  it("renders for a logged-out visitor without asking to sign in", async () => {
    await renderAsVisitor();
    expect(screen.getByRole("banner")).toHaveTextContent("LaughterMaster");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
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
