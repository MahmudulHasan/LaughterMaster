import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AllJokesList } from "@/components/jokes/AllJokesList";
import { PostJokeButton } from "@/components/jokes/PostJokeButton";
import { makePage } from "@/components/jokes/testFixtures";
import { auth } from "@/auth";
import { listJokes } from "@/server/jokes/queries";

import AllJokesPage from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("@/server/auth/providers", () => ({
  getSignInOptions: () => ({ google: true, devUsers: [] }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/jokes" }));
vi.mock("@/server/db/ready", () => ({ getReadyDb: vi.fn(async () => "db") }));
vi.mock("@/server/jokes/queries", () => ({ listJokes: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.mocked(listJokes).mockReset();
  mockAuth.mockReset().mockResolvedValue(null);
  window.sessionStorage.clear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("/jokes", () => {
  it("has the heading and sort note", () => {
    render(<AllJokesPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "All jokes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("server-renders the first batch from listJokes", async () => {
    vi.mocked(listJokes).mockResolvedValue(makePage(1, 20, "c1"));
    render(await AllJokesList());
    expect(listJokes).toHaveBeenCalledWith("db");
    expect(screen.getAllByRole("article")).toHaveLength(20);
    expect(
      screen.getByRole("button", { name: "Load more jokes" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state with a Post a joke action", async () => {
    vi.mocked(listJokes).mockResolvedValue({ jokes: [], nextCursor: null });
    render(await AllJokesList());
    expect(screen.getByText("No jokes yet. Be the first!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Post a joke" }),
    ).toBeInTheDocument();
  });
});

describe("PostJokeButton", () => {
  it("links members to /post", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Mina", image: null },
    });
    render(await PostJokeButton({}));
    expect(screen.getByRole("link", { name: "Post a joke" })).toHaveAttribute(
      "href",
      "/post",
    );
  });

  it("opens the sign-in dialog for visitors", async () => {
    render(await PostJokeButton({}));
    expect(screen.getByRole("button", { name: "Post a joke" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });
});
