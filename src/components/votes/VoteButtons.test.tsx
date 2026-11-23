import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SignInOptions } from "@/server/auth/types";

import { OWN_JOKE_NOTE, VoteButtons } from "./VoteButtons";

vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const options: SignInOptions = { google: true, devUsers: [] };

function mockFetch(...responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(
      new Response(JSON.stringify(r.body), { status: r.status }),
    );
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const like = () => screen.getByRole("button", { name: /^(like|liked)$/i });
const dislike = () =>
  screen.getByRole("button", { name: /^(dislike|disliked)$/i });

describe("VoteButtons (US-8)", () => {
  it("lets a member like, switch and remove, with aria-pressed", async () => {
    const fetch = mockFetch(
      { status: 200, body: { myVote: 1 } },
      { status: 200, body: { myVote: -1 } },
      { status: 200, body: { myVote: null } },
    );
    render(<VoteButtons jokeId="j1" voter="member" signInOptions={options} />);
    expect(like()).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(like());
    await waitFor(() => expect(like()).toHaveAttribute("aria-pressed", "true"));
    expect(like()).toHaveTextContent("Liked");
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/jokes/j1/vote",
      expect.objectContaining({ method: "POST", body: '{"value":1}' }),
    );

    await userEvent.click(dislike());
    await waitFor(() =>
      expect(dislike()).toHaveAttribute("aria-pressed", "true"),
    );
    expect(like()).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(dislike());
    await waitFor(() =>
      expect(dislike()).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("starts from the member's saved vote", () => {
    render(
      <VoteButtons
        jokeId="j1"
        voter="member"
        myVote={-1}
        signInOptions={options}
      />,
    );
    expect(dislike()).toHaveAttribute("aria-pressed", "true");
    expect(dislike()).toHaveTextContent("Disliked");
  });

  it("rolls back and explains when the server refuses", async () => {
    mockFetch({ status: 401, body: { error: "not_signed_in" } });
    render(<VoteButtons jokeId="j1" voter="member" signInOptions={options} />);
    await userEvent.click(like());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/sign in again/i),
    );
    expect(like()).toHaveAttribute("aria-pressed", "false");
  });

  it("disables both buttons on the author's own joke, with a note", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<VoteButtons jokeId="j1" voter="author" signInOptions={options} />);
    expect(like()).toBeDisabled();
    expect(dislike()).toBeDisabled();
    expect(like()).toHaveAttribute("title", OWN_JOKE_NOTE);
    expect(screen.getByText(OWN_JOKE_NOTE)).toBeInTheDocument();
  });

  it("asks visitors to sign in, titled for the action", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<VoteButtons jokeId="j1" voter="visitor" signInOptions={options} />);
    await userEvent.click(dislike());
    expect(
      screen.getByRole("dialog", { name: "Sign in to dislike jokes" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never shows a vote count", () => {
    render(
      <VoteButtons
        jokeId="j1"
        voter="member"
        myVote={1}
        signInOptions={options}
      />,
    );
    expect(document.body.textContent).not.toMatch(/\d/);
  });
});
