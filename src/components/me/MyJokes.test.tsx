import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import type { MyJokeStats } from "@/server/jokes/types";
import { getMyJokeStats } from "@/server/jokes/votes";

import { MyJokes } from "./MyJokes";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/providers", () => ({
  getSignInOptions: () => ({ google: true, devUsers: [] }),
}));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("@/server/db/ready", () => ({ getReadyDb: vi.fn(async () => "db") }));
vi.mock("@/server/jokes/votes", () => ({ getMyJokeStats: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/me",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/profile/actions", () => ({
  updateDisplayNameAction: vi.fn(),
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockStats = getMyJokeStats as unknown as ReturnType<typeof vi.fn>;

const joke: MyJokeStats = {
  id: "j1",
  text: "My best joke",
  status: "approved",
  author: { id: "mina", displayName: "Mina Park", avatarUrl: null },
  createdAt: "2026-11-23T10:00:00.000Z",
  isBot: false,
  category: null,
  likes: 5,
  dislikes: 2,
  score: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyJokes (US-9)", () => {
  it("shows the signed-in author's likes, dislikes and score", async () => {
    mockAuth.mockResolvedValue({ user: { id: "mina", name: "Mina Park" } });
    mockStats.mockResolvedValue([joke]);
    render(await MyJokes());
    expect(mockStats).toHaveBeenCalledWith("db", "mina");
    const stats = screen.getByLabelText("Your private stats");
    for (const [label, value] of [
      ["Likes", "5"],
      ["Dislikes", "2"],
      ["Score", "3"],
    ]) {
      expect(within(stats).getByText(label!).nextSibling).toHaveTextContent(
        value!,
      );
    }
  });

  it("asks visitors to sign in and reads no stats", async () => {
    mockAuth.mockResolvedValue(null);
    render(await MyJokes());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(mockStats).not.toHaveBeenCalled();
  });

  it("has an empty state with a link to post", async () => {
    mockAuth.mockResolvedValue({ user: { id: "mina", name: "Mina Park" } });
    mockStats.mockResolvedValue([]);
    render(await MyJokes());
    expect(screen.getByRole("link", { name: "Post a joke" })).toHaveAttribute(
      "href",
      "/post",
    );
  });
});
