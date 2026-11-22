import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JokeListItem, JokeListPage } from "@/lib/joke-list-item";

import { deleteJokeAction } from "@/app/joke/actions";

import { LazyJokeList } from "./LazyJokeList";

vi.mock("@/app/joke/actions", () => ({ deleteJokeAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
const mockDelete = deleteJokeAction as unknown as ReturnType<typeof vi.fn>;

const NOW = "2026-11-22T12:00:00.000Z";

function joke(n: number): JokeListItem {
  return {
    id: `j${n}`,
    text: `Joke number ${n} is funny`,
    category: n % 2 ? "Puns" : null,
    isBot: false,
    createdAt: new Date(Date.parse(NOW) - n * 60 * 60 * 1000).toISOString(),
    author: { id: "dev-mina", displayName: "Mina Park", avatarUrl: null },
  };
}
const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => joke(from + i));

// jsdom has no IntersectionObserver. Each fake registers while observing,
// and `intersect()` fires every observer that is still connected, as the
// browser would when the sentinel scrolls into view.
const observers = new Set<FakeObserver>();
const intersect = () => {
  for (const o of [...observers]) o.fire();
};
class FakeObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  fire() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  observe() {
    observers.add(this);
  }
  disconnect() {
    observers.delete(this);
  }
  unobserve() {
    observers.delete(this);
  }
}

const fetchMock = vi.fn();
function respond(page: JokeListPage) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(page), { status: 200 }),
  );
}

function renderList(
  page: JokeListPage,
  props: { author?: string; canDelete?: boolean } = {},
) {
  return render(
    <LazyJokeList
      listKey="test"
      initialPage={page}
      now={NOW}
      emptyState={<p>No jokes yet</p>}
      {...props}
    />,
  );
}

const items = () =>
  within(screen.getByRole("list", { name: "Jokes" })).getAllByRole("listitem");

describe("LazyJokeList", () => {
  beforeEach(() => {
    observers.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the first batch with author links, categories and times", () => {
    renderList({ jokes: range(1, 3), nextCursor: null });
    expect(items()).toHaveLength(2);
    const first = within(items()[0]!);
    expect(first.getByText("Joke number 1 is funny")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /Mina Park/ })).toHaveAttribute(
      "href",
      "/u/dev-mina",
    );
    expect(first.getByText("Puns")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /1h ago/ })).toHaveAttribute(
      "href",
      "/joke/j1",
    );
  });

  it("shows the empty state when there are no jokes", () => {
    renderList({ jokes: [], nextCursor: null });
    expect(screen.getByText("No jokes yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Jokes" })).toBeNull();
    expect(screen.queryByText("You've seen every joke")).toBeNull();
  });

  it("always offers Load more while there are more jokes", async () => {
    respond({ jokes: range(21, 41), nextCursor: "j40" });
    const user = userEvent.setup();
    renderList({ jokes: range(1, 21), nextCursor: "j20" });

    await user.click(screen.getByRole("button", { name: "Load more jokes" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/jokes?cursor=j20", {
      cache: "no-store",
    });
    expect(await screen.findByText("Joke number 40 is funny")).toBeVisible();
    expect(items()).toHaveLength(40);
    expect(screen.getByRole("status")).toHaveTextContent(
      "20 more jokes loaded",
    );
    expect(
      screen.getByRole("button", { name: "Load more jokes" }),
    ).toBeInTheDocument();
  });

  it("loads automatically near the end and passes the author filter", async () => {
    respond({ jokes: range(21, 23), nextCursor: null });
    renderList(
      { jokes: range(1, 21), nextCursor: "j20" },
      { author: "dev-mina" },
    );

    await act(async () => intersect());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jokes?cursor=j20&author=dev-mina",
      { cache: "no-store" },
    );
    expect(await screen.findByText("You've seen every joke")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 more jokes loaded");
  });

  it("shows two skeletons and announces loading while a batch loads", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (finish = r)));
    renderList({ jokes: range(1, 21), nextCursor: "j20" });

    await act(async () => intersect());
    expect(screen.getByRole("status")).toHaveTextContent("Loading more jokes…");
    expect(screen.getAllByTestId("joke-skeleton")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Load more jokes" }),
    ).toBeDisabled();

    // A second trigger while loading doesn't start another request.
    await act(async () => intersect());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () =>
      finish(
        new Response(JSON.stringify({ jokes: [], nextCursor: null }), {
          status: 200,
        }),
      ),
    );
    expect(screen.queryAllByTestId("joke-skeleton")).toHaveLength(0);
  });

  it("keeps the shown jokes and offers Retry when a batch fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    respond({ jokes: range(21, 22), nextCursor: null });
    const user = userEvent.setup();
    renderList({ jokes: range(1, 21), nextCursor: "j20" });

    await act(async () => intersect());
    expect(await screen.findByText("Couldn't load more jokes")).toBeVisible();
    expect(items()).toHaveLength(20);

    // Automatic loading pauses until the reader retries.
    await act(async () => intersect());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Joke number 21 is funny")).toBeVisible();
    expect(screen.queryByText("Couldn't load more jokes")).toBeNull();
  });

  it("treats a network error like a failed batch", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderList({ jokes: range(1, 21), nextCursor: "j20" });
    await act(async () => intersect());
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("shows the end message with Post the next one when everything is shown", () => {
    renderList({ jokes: range(1, 4), nextCursor: null });
    expect(screen.getByText("You've seen every joke")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Post the next one" }),
    ).toHaveAttribute("href", "/post");
    expect(
      screen.queryByRole("button", { name: "Load more jokes" }),
    ).toBeNull();
  });

  it("offers no Delete buttons unless asked to", () => {
    renderList({ jokes: range(1, 3), nextCursor: null });
    expect(
      screen.queryByRole("button", { name: "Delete this joke" }),
    ).toBeNull();
  });

  it("removes a joke from the list once its owner deletes it", async () => {
    mockDelete.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderList({ jokes: range(1, 4), nextCursor: null }, { canDelete: true });

    const second = within(items()[1]!);
    await user.click(second.getByRole("button", { name: "Delete this joke" }));
    await user.click(screen.getByRole("button", { name: "Delete joke" }));

    expect(mockDelete).toHaveBeenCalledWith("j2");
    expect(screen.queryByText("Joke number 2 is funny")).toBeNull();
    expect(items()).toHaveLength(2);
  });

  it("never shows the same joke twice", async () => {
    respond({ jokes: [joke(20), ...range(21, 23)], nextCursor: null });
    const user = userEvent.setup();
    renderList({ jokes: range(1, 21), nextCursor: "j20" });
    await user.click(screen.getByRole("button", { name: "Load more jokes" }));
    await screen.findByText("Joke number 22 is funny");
    expect(screen.getAllByText("Joke number 20 is funny")).toHaveLength(1);
  });
});
