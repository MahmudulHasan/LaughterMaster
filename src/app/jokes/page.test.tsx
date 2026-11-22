import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPublicJokes } from "@/server/jokes/list";

import { AllJokesList } from "./page";

vi.mock("@/server/db/app-db", () => ({ getAppDb: vi.fn() }));
vi.mock("@/app/joke/actions", () => ({ deleteJokeAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/jokes/list", () => ({ listPublicJokes: vi.fn() }));
const mockList = listPublicJokes as unknown as ReturnType<typeof vi.fn>;

describe("/jokes", () => {
  beforeEach(() => {
    mockList.mockReset();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("server-renders the first batch for a logged-out visitor", async () => {
    mockList.mockResolvedValue({
      jokes: [
        {
          id: "j1",
          text: "The first joke on the page",
          category: null,
          isBot: false,
          createdAt: new Date(),
          author: { id: "dev-mina", displayName: "Mina", avatarUrl: null },
        },
      ],
      nextCursor: "j1",
    });
    render(await AllJokesList());
    expect(screen.getByText("The first joke on the page")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load more jokes" }),
    ).toBeInTheDocument();
    expect(mockList.mock.calls[0]?.[1]).toEqual({});
  });

  it("shows the empty state with Post a joke when there are no jokes", async () => {
    mockList.mockResolvedValue({ jokes: [], nextCursor: null });
    render(await AllJokesList());
    expect(screen.getByText("No jokes yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a joke" })).toHaveAttribute(
      "href",
      "/post",
    );
  });
});
