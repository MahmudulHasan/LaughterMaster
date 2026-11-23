import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getPostsLeftToday } from "@/server/jokes/actions";

import { PostJokeGate } from "./PostJokeGate";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/providers", () => ({
  getSignInOptions: () => ({ google: true, devUsers: [] }),
}));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("@/server/jokes/actions", () => ({
  createJokeAction: vi.fn(),
  getPostsLeftToday: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/post" }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
});

// `auth` is overloaded (it is also middleware); only the zero-arg form is used.
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockPostsLeft = vi.mocked(getPostsLeftToday);

beforeEach(() => {
  mockAuth.mockReset();
  mockPostsLeft.mockReset();
});

describe("PostJokeGate", () => {
  it("logged out: explains and offers sign-in, with no form", async () => {
    mockAuth.mockResolvedValue(null);
    render(await PostJokeGate());
    expect(
      screen.getByRole("heading", { name: "Sign in to post a joke" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post joke" })).toBeNull();
    expect(mockPostsLeft).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Sign in to post" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Sign in to post a joke",
    });
    expect(dialog.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/post",
    );
  });

  it("logged in: shows the form and posts left today", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Mina", image: null },
      expires: "",
    });
    mockPostsLeft.mockResolvedValue(4);
    render(await PostJokeGate());
    expect(
      screen.getByRole("textbox", { name: "Your joke" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 of 10 posts left today")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign in to post" }),
    ).toBeNull();
  });
});
