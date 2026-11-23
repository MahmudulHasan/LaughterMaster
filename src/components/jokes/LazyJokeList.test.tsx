import {
  act,
  configure,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JokePage, JokeView } from "@/server/jokes/types";

import { LazyJokeList } from "./LazyJokeList";
import { makeJoke, makePage } from "./testFixtures";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/jokes" }));

// --- IntersectionObserver mock: tests trigger intersections by hand. ---
type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observers: Array<{ callback: Callback; disconnected: boolean }> = [];
class MockObserver {
  record: { callback: Callback; disconnected: boolean };
  constructor(callback: Callback) {
    this.record = { callback, disconnected: false };
    observers.push(this.record);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.record.disconnected = true;
  }
}
function intersect() {
  act(() => {
    for (const o of observers.filter((o) => !o.disconnected)) {
      o.callback([{ isIntersecting: true }]);
    }
  });
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

// Generous timeout: the full suite runs many jsdom files in parallel.
configure({ asyncUtilTimeout: 5000 });

const fetchMock = vi.fn<typeof fetch>();
const KEY = "lm:list:/jokes";

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", MockObserver);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderList(initialPage: JokePage = makePage(1, 20, "c1")) {
  return render(
    <StrictMode>
      <LazyJokeList
        initialPage={initialPage}
        endpoint="/api/jokes"
        storageKey="/jokes"
        emptyState={<p>Nothing here</p>}
      />
    </StrictMode>,
  );
}

const cards = () => screen.getAllByRole("article");

type StoredFixture = {
  jokes: JokeView[];
  nextCursor: string | null;
  cursors?: Array<[string, string]>;
  scrollY?: number;
};

function store({
  jokes,
  nextCursor,
  cursors = [],
  scrollY = 0,
}: StoredFixture) {
  window.sessionStorage.setItem(
    KEY,
    JSON.stringify({ v: 2, jokes, nextCursor, cursors, scrollY }),
  );
}

/**
 * Simulates arriving at the list's history entry after a full page load of
 * the given type: the entry carries the mark an earlier document wrote.
 */
function arriveByFullLoad(type: NavigationTimingType) {
  window.history.replaceState(
    { __NA: true, __lmList: { key: "/jokes", doc: "earlier-document" } },
    "",
  );
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type } as PerformanceNavigationTiming,
  ]);
}

describe("LazyJokeList", () => {
  it("renders the first batch and a Load more button", () => {
    renderList();
    expect(cards()).toHaveLength(20);
    expect(
      screen.getByRole("button", { name: "Load more jokes" }),
    ).toBeInTheDocument();
  });

  it("loads the next batch with the button, passing the cursor", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(21, 40, "c2")));
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(40));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/jokes?cursor=c1");
    expect(screen.getByRole("status")).toHaveTextContent(
      "20 more jokes loaded",
    );
  });

  it("auto-loads when the end comes into range", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(21, 40, "c2")));
    renderList();
    intersect();
    await waitFor(() => expect(cards()).toHaveLength(40));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows 2 skeletons and announces loading while a batch is in flight", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(screen.getAllByTestId("joke-skeleton")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more jokes…");
    // A second trigger while loading doesn't fire another request.
    intersect();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(await jsonResponse(makePage(21, 40, "c2"))));
    await waitFor(() =>
      expect(screen.queryAllByTestId("joke-skeleton")).toHaveLength(0),
    );
  });

  it("shows an error with Retry and keeps the loaded jokes", async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockReturnValueOnce(jsonResponse(makePage(21, 40, "c2")));
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(await screen.findByTestId("load-error")).toHaveTextContent(
      "Couldn't load more jokes",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't load more jokes",
    );
    expect(cards()).toHaveLength(20);
    // Auto-loading pauses on error.
    intersect();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(cards()).toHaveLength(40));
    expect(screen.queryByTestId("load-error")).not.toBeInTheDocument();
  });

  it("treats a network failure as an error too", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(
      await screen.findByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });

  it("shows the end state when there are no more jokes", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(21, 25, null)));
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(
      await screen.findByText("You've seen every joke"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Post the next one" }),
    ).toHaveAttribute("href", "/post");
    expect(
      screen.queryByRole("button", { name: "Load more jokes" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("5 more jokes loaded");
    intersect();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the end state immediately for a short single batch", () => {
    renderList(makePage(1, 3, null));
    expect(screen.getByText("You've seen every joke")).toBeInTheDocument();
  });

  it("renders the empty state when there are no jokes", () => {
    renderList({ jokes: [], nextCursor: null });
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("drops duplicate jokes from a batch", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        jokes: [makeJoke(20), makeJoke(21), makeJoke(21)],
        nextCursor: null,
      }),
    );
    renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(21));
    expect(screen.getByRole("status")).toHaveTextContent("1 more joke loaded");
  });

  it("saves loaded jokes and restores them with the scroll position after a client-side Back", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(21, 40, "c2")));
    const first = renderList();
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(40));
    Object.defineProperty(window, "scrollY", {
      value: 1234,
      configurable: true,
    });
    window.dispatchEvent(new Event("pagehide"));
    first.unmount();

    const stored = JSON.parse(window.sessionStorage.getItem(KEY)!);
    expect(stored.jokes).toHaveLength(40);
    expect(stored.nextCursor).toBe("c2");
    expect(stored.scrollY).toBe(1234);

    // Back: the server renders the first batch again.
    renderList();
    await waitFor(() => expect(cards()).toHaveLength(40));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1234);
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(41, 41, null)));
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/jokes?cursor=c2");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("puts jokes posted meanwhile first when restoring", async () => {
    store({ jokes: makePage(1, 40, null).jokes, nextCursor: "c2" });
    arriveByFullLoad("back_forward");
    const fresh = {
      jokes: [makeJoke(0), ...makePage(1, 19, null).jokes],
      nextCursor: "x",
    };
    renderList(fresh);
    await waitFor(() => expect(cards()).toHaveLength(41));
    expect(cards()[0]).toHaveTextContent("Joke number 0,");
  });

  it("ignores and clears stored jokes on a normal visit", async () => {
    store({
      jokes: makePage(1, 40, null).jokes,
      nextCursor: "c2",
      scrollY: 900,
    });
    renderList();
    expect(cards()).toHaveLength(20);
    // The list then stores its own fresh state, never the old 40 jokes.
    await waitFor(() =>
      expect(
        JSON.parse(window.sessionStorage.getItem(KEY)!).jokes,
      ).toHaveLength(20),
    );
    expect(cards()).toHaveLength(20);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("ignores stored jokes after a reload", async () => {
    store({ jokes: makePage(1, 40, null).jokes, nextCursor: "c2" });
    arriveByFullLoad("reload");
    renderList();
    await waitFor(() =>
      expect(
        JSON.parse(window.sessionStorage.getItem(KEY)!).jokes,
      ).toHaveLength(20),
    );
    expect(cards()).toHaveLength(20);
  });

  it("restores after Back to a fully loaded page", async () => {
    store({
      jokes: makePage(1, 40, null).jokes,
      nextCursor: "c2",
      scrollY: 777,
    });
    arriveByFullLoad("back_forward");
    renderList();
    await waitFor(() => expect(cards()).toHaveLength(40));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 777);
  });

  it("drops a stored joke the fresh batch no longer has within its range", async () => {
    store({ jokes: makePage(1, 40, null).jokes, nextCursor: "c2" });
    arriveByFullLoad("back_forward");
    // Joke 5 was deleted, so the fresh batch reaches one joke further.
    const fresh = {
      jokes: makePage(1, 21, null).jokes.filter((j) => j.id !== "joke-5"),
      nextCursor: "c21",
    };
    renderList(fresh);
    await waitFor(() => expect(cards()).toHaveLength(39));
    expect(screen.queryByText(/Joke number 5,/)).not.toBeInTheDocument();
    expect(screen.getByText(/Joke number 40,/)).toBeInTheDocument();
  });

  it("drops stored jokes when the fresh batch says the list ends", async () => {
    store({ jokes: makePage(1, 40, null).jokes, nextCursor: "c2" });
    arriveByFullLoad("back_forward");
    renderList(makePage(1, 3, null));
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(screen.getByText("You've seen every joke")).toBeInTheDocument();
  });

  it("drops stored jokes when a gap may separate them from the fresh batch", async () => {
    store({ jokes: makePage(1, 40, null).jokes, nextCursor: "c2" });
    arriveByFullLoad("back_forward");
    // More than a batch of new jokes: the fresh batch ends above joke 1.
    const fresh = { jokes: makePage(-25, -6, null).jokes, nextCursor: "n" };
    renderList(fresh);
    await waitFor(() =>
      expect(
        JSON.parse(window.sessionStorage.getItem(KEY)!).jokes,
      ).toHaveLength(20),
    );
    expect(cards()).toHaveLength(20);
  });

  it("cuts a long stored list after a batch and keeps its cursor", async () => {
    // Batches of 20 after joke 0 (posted meanwhile) end at 20, 40, … 500.
    const cursors: Array<[string, string]> = [];
    for (let n = 20; n <= 500; n += 20) cursors.push([`joke-${n}`, `c${n}`]);
    store({ jokes: makePage(1, 500, null).jokes, nextCursor: "c500", cursors });
    arriveByFullLoad("back_forward");
    const fresh = {
      jokes: [makeJoke(0), ...makePage(1, 19, null).jokes],
      nextCursor: "fresh",
    };
    const first = renderList(fresh);
    await waitFor(() => expect(cards()).toHaveLength(501));
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(501, 520, "c520")));
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/jokes?cursor=c500");
    await waitFor(() => expect(cards()).toHaveLength(521));
    first.unmount();

    // 521 jokes: the cut falls back to the last batch end within the cap.
    const stored = JSON.parse(window.sessionStorage.getItem(KEY)!);
    expect(stored.jokes).toHaveLength(481);
    expect(stored.jokes.at(-1).id).toBe("joke-480");
    expect(stored.nextCursor).toBe("c480");

    // Back again: the list continues from the cut instead of ending.
    renderList(fresh);
    await waitFor(() => expect(cards()).toHaveLength(481));
    expect(
      screen.queryByText("You've seen every joke"),
    ).not.toBeInTheDocument();
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(481, 500, "c500")));
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/jokes?cursor=c480");
  }, 20_000);

  it("ignores corrupt stored data", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    renderList();
    expect(cards()).toHaveLength(20);
  });

  it("still works when sessionStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fetchMock.mockReturnValueOnce(jsonResponse(makePage(21, 40, "c2")));
    renderList();
    expect(cards()).toHaveLength(20);
    await userEvent.click(
      screen.getByRole("button", { name: "Load more jokes" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(40));
  });
});
