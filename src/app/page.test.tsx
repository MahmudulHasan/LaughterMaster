import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { TopJokes } from "@/components/home/TopJokes";
import type {
  RankedJoke,
  TopJokes as TopJokesData,
} from "@/server/jokes/types";
import { getTopJokes, withMyVotes } from "@/server/jokes/votes";

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
vi.mock("@/server/jokes/votes", () => ({
  getTopJokes: vi.fn(),
  withMyVotes: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockTop = getTopJokes as unknown as ReturnType<typeof vi.fn>;
const mockWithVotes = withMyVotes as unknown as ReturnType<typeof vi.fn>;

function ranked(id: string, rank: number, authorId = "priya"): RankedJoke {
  return {
    id,
    rank,
    text: `Joke ${id}`,
    status: "approved",
    author: { id: authorId, displayName: `Name ${authorId}`, avatarUrl: null },
    createdAt: "2026-11-23T10:00:00.000Z",
    isBot: false,
    category: null,
  };
}

async function renderTop(data: TopJokesData) {
  mockTop.mockResolvedValue(data);
  render(await TopJokes());
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockWithVotes.mockImplementation(async (_db, _viewer, list) => list);
  });

  it("renders for a logged-out visitor without asking to sign in", async () => {
    const header = await SiteHeader();
    render(
      <>
        {header}
        <Home />
      </>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent("LaughterMaster");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the heading and how the ranking works", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Top 10 of the day" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/likes minus dislikes/i)).toBeInTheDocument();
  });
});

describe("TopJokes (US-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockWithVotes.mockImplementation(async (_db, _viewer, list) => list);
  });

  it("shows ranked jokes and the 'From this week' fill", async () => {
    await renderTop({
      today: [ranked("a", 1), ranked("b", 2)],
      week: [ranked("c", 3)],
    });
    expect(screen.getByLabelText("Rank 1")).toHaveTextContent("#1");
    expect(screen.getByLabelText("Rank 3")).toHaveTextContent("#3");
    expect(
      screen.getByRole("heading", { name: "From this week" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("shows the empty state when there are no jokes", async () => {
    await renderTop({ today: [], week: [] });
    expect(screen.getByText("No jokes yet. Be the first!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Post a joke" }),
    ).toBeInTheDocument();
  });

  it("gives visitors sign-in buttons and members real votes", async () => {
    await renderTop({ today: [ranked("a", 1)], week: [] });
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );

    vi.clearAllMocks();
    document.body.innerHTML = "";
    mockAuth.mockResolvedValue({ user: { id: "mina" } });
    mockWithVotes.mockImplementation(async (_db, _viewer, list) =>
      list.map((j: RankedJoke) => ({ ...j, myVote: 1 })),
    );
    await renderTop({ today: [ranked("a", 1)], week: [] });
    expect(screen.getByRole("button", { name: "Liked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mockWithVotes).toHaveBeenCalledWith("db", "mina", expect.any(Array));
  });

  it("disables voting on the viewer's own joke", async () => {
    mockAuth.mockResolvedValue({ user: { id: "priya" } });
    await renderTop({ today: [ranked("a", 1, "priya")], week: [] });
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
  });

  it("never shows vote counts", async () => {
    await renderTop({ today: [ranked("a", 1)], week: [] });
    expect(document.body.textContent).not.toMatch(/likes|dislikes/i);
  });
});
