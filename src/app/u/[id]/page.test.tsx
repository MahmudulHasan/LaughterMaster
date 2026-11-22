import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import type { PublicJoke } from "@/server/jokes/read";
import { listPublicJokes } from "@/server/jokes/list";
import { getPublicProfile, listPendingJokes } from "@/server/profiles/profile";

import ProfileNotFound from "./not-found";
import { ProfileBody } from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/joke/actions", () => ({ deleteJokeAction: vi.fn() }));
vi.mock("@/server/db/app-db", () => ({ getAppDb: vi.fn() }));
vi.mock("@/server/jokes/list", () => ({ listPublicJokes: vi.fn() }));
vi.mock("@/server/profiles/profile", () => ({
  getPublicProfile: vi.fn(),
  listPendingJokes: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const params = (id: string) => Promise.resolve({ id });
const author = { id: "dev-mina", displayName: "Mina Park", avatarUrl: null };
const joke = (id: string, text: string): PublicJoke => ({
  id,
  text,
  category: null,
  isBot: false,
  createdAt: new Date(),
  author,
});
const signedInAs = (id: string | null) =>
  mocked(auth).mockResolvedValue(
    id ? { user: { id, name: id, image: null } } : null,
  );

describe("/u/[id]", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    mocked(getPublicProfile).mockResolvedValue({
      ...author,
      joinedAt: new Date("2026-11-03T00:00:00Z"),
      jokeCount: 1,
    });
    mocked(listPublicJokes).mockResolvedValue({
      jokes: [joke("j1", "Mina's approved joke")],
      nextCursor: null,
    });
    mocked(listPendingJokes).mockReset();
    mocked(listPendingJokes).mockResolvedValue([
      joke("p1", "Mina's joke still being checked"),
    ]);
    signedInAs(null);
  });

  it("shows name, join month, joke count and approved jokes to visitors", async () => {
    render(await ProfileBody({ params: params("dev-mina") }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Mina Park" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Joined November 2026 · 1 joke"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mina's approved joke")).toBeInTheDocument();
    expect(mocked(listPublicJokes).mock.calls.at(-1)?.[1]).toEqual({
      authorId: "dev-mina",
    });
  });

  it.each([
    ["a visitor", null],
    ["another member", "dev-priya"],
  ])("hides pending jokes and Delete from %s", async (_who, viewer) => {
    signedInAs(viewer);
    render(await ProfileBody({ params: params("dev-mina") }));
    expect(screen.queryByText("Mina's joke still being checked")).toBeNull();
    expect(screen.queryByText("Under review")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete this joke" }),
    ).toBeNull();
    expect(listPendingJokes).not.toHaveBeenCalled();
  });

  it("shows the owner their pending jokes marked Under review, and Delete", async () => {
    signedInAs("dev-mina");
    render(await ProfileBody({ params: params("dev-mina") }));
    const review = within(
      screen.getByRole("list", { name: "Jokes under review" }),
    );
    expect(review.getByText("Mina's joke still being checked")).toBeVisible();
    expect(review.getByText("Under review")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Delete this joke" }),
    ).toHaveLength(2);
    expect(screen.getByText(/You're viewing your own profile/)).toBeVisible();
  });

  it("says when the member hasn't posted any jokes yet", async () => {
    mocked(listPublicJokes).mockResolvedValue({ jokes: [], nextCursor: null });
    mocked(getPublicProfile).mockResolvedValue({
      ...author,
      joinedAt: new Date("2026-11-03T00:00:00Z"),
      jokeCount: 0,
    });
    render(await ProfileBody({ params: params("dev-mina") }));
    expect(
      screen.getByText("Mina Park hasn't posted any jokes yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Joined November 2026 · 0 jokes")).toBeVisible();
  });

  it("calls notFound for an unknown or banned member", async () => {
    mocked(getPublicProfile).mockResolvedValue(null);
    await expect(ProfileBody({ params: params("nobody") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has a friendly not-available page", () => {
    render(<ProfileNotFound />);
    expect(
      screen.getByRole("heading", { name: "This profile isn't available" }),
    ).toBeInTheDocument();
  });
});
