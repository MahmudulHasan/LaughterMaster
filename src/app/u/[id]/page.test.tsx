import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileContent } from "@/components/jokes/ProfileContent";
import { makeJoke, makePage } from "@/components/jokes/testFixtures";
import { auth } from "@/auth";
import { getProfile, listUserJokes } from "@/server/jokes/queries";
import type { ProfileView } from "@/server/jokes/types";

import ProfileNotFound from "./not-found";
import { generateMetadata } from "./page";

vi.mock("@/server/jokes/votes", () => ({
  withMyVotes: async (_db: unknown, _viewer: unknown, list: unknown) => list,
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/u/u1",
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/server/db/ready", () => ({ getReadyDb: vi.fn(async () => "db") }));
vi.mock("@/server/jokes/queries", () => ({
  getProfile: vi.fn(),
  listUserJokes: vi.fn(),
}));

const { notFound } = await import("next/navigation");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const profile: ProfileView = {
  user: { id: "u1", displayName: "Mina Park", avatarUrl: null },
  joinedAt: "2026-03-15T09:00:00.000Z",
  approvedJokeCount: 12,
};
const params = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  vi.mocked(getProfile).mockReset().mockResolvedValue(profile);
  vi.mocked(listUserJokes)
    .mockReset()
    .mockResolvedValue(makePage(1, 3, null));
  vi.mocked(notFound).mockClear();
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

describe("/u/[id] profile", () => {
  it("shows the header card to visitors without owner extras", async () => {
    render(await ProfileContent({ params: params("u1") }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Mina Park" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Joined March 2026 · 12 jokes"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/viewing your own profile/),
    ).not.toBeInTheDocument();
    expect(listUserJokes).toHaveBeenCalledWith("db", {
      userId: "u1",
      viewerId: null,
    });
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("uses the singular for one joke", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      ...profile,
      approvedJokeCount: 1,
    });
    render(await ProfileContent({ params: params("u1") }));
    expect(screen.getByText("Joined March 2026 · 1 joke")).toBeInTheDocument();
  });

  it("shows the owner note and their pending jokes as Under review", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Mina Park", image: null },
    });
    vi.mocked(listUserJokes).mockResolvedValue({
      jokes: [makeJoke(1, { status: "pending" }), makeJoke(2)],
      nextCursor: null,
    });
    render(await ProfileContent({ params: params("u1") }));
    expect(
      screen.getByText(
        "You're viewing your own profile. Jokes under review are only visible to you.",
      ),
    ).toBeInTheDocument();
    expect(listUserJokes).toHaveBeenCalledWith("db", {
      userId: "u1",
      viewerId: "u1",
    });
    expect(screen.getAllByText("Under review")).toHaveLength(1);
  });

  it("treats another signed-in member as a visitor", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u2", name: "Priya", image: null },
    });
    render(await ProfileContent({ params: params("u1") }));
    expect(
      screen.queryByText(/viewing your own profile/),
    ).not.toBeInTheDocument();
    expect(listUserJokes).toHaveBeenCalledWith("db", {
      userId: "u1",
      viewerId: "u2",
    });
  });

  it("shows the empty state when the member has no jokes", async () => {
    vi.mocked(listUserJokes).mockResolvedValue({ jokes: [], nextCursor: null });
    render(await ProfileContent({ params: params("u1") }));
    expect(
      screen.getByText("Mina Park hasn't posted any jokes yet."),
    ).toBeInTheDocument();
  });

  it("calls notFound() for an unknown or banned member", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    await expect(ProfileContent({ params: params("ghost") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(listUserJokes).not.toHaveBeenCalled();
  });

  it("never shows an email or vote counts", async () => {
    const { container } = render(
      await ProfileContent({ params: params("u1") }),
    );
    expect(container.textContent).not.toMatch(/@|likes|dislikes|score/i);
  });

  it("not-found page says the profile isn't available", () => {
    render(<ProfileNotFound />);
    expect(
      screen.getByRole("heading", { name: "This profile isn't available" }),
    ).toBeInTheDocument();
  });

  it("titles the tab with the member's name", async () => {
    expect(await generateMetadata({ params: params("u1") })).toEqual({
      title: "Mina Park · LaughterMaster",
    });
  });

  it("uses a generic title for an unknown member", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    expect(await generateMetadata({ params: params("ghost") })).toEqual({
      title: "Member profile · LaughterMaster",
    });
  });
});
