import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getSignInOptions } from "@/server/auth/providers";

import { SiteHeader } from "./SiteHeader";
import { initials } from "./UserMenu";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/auth/providers", () => ({ getSignInOptions: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));

const search = { value: "" };
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ replace }),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

// `auth` is overloaded (it is also middleware); the tests only use the
// zero-argument form, so a loose mock type is enough.
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockOptions = vi.mocked(getSignInOptions);

beforeEach(() => {
  search.value = "";
  replace.mockReset();
  mockAuth.mockReset();
  mockOptions.mockReturnValue({ google: true, devUsers: [] });
});

async function renderHeader() {
  render(await SiteHeader());
  return screen.getByRole("banner");
}

describe("SiteHeader", () => {
  it("shows the brand and nav links", async () => {
    mockAuth.mockResolvedValue(null);
    const banner = await renderHeader();
    expect(banner).toHaveTextContent("LaughterMaster");
    const nav = within(banner).getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Top 10" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(nav).getByRole("link", { name: "All jokes" }),
    ).toHaveAttribute("href", "/jokes");
  });

  describe("logged out", () => {
    beforeEach(() => mockAuth.mockResolvedValue(null));

    it("shows Sign in, and Post a joke stays visible", async () => {
      const banner = await renderHeader();
      expect(
        within(banner).getByRole("button", { name: "Sign in" }),
      ).toBeEnabled();
      expect(
        within(banner).getByRole("button", { name: "Post a joke" }),
      ).toBeEnabled();
      expect(within(banner).queryByRole("button", { name: "Sign out" })).toBe(
        null,
      );
    });

    it("Sign in opens the dialog titled Sign in to LaughterMaster", async () => {
      const banner = await renderHeader();
      await userEvent.click(
        within(banner).getByRole("button", { name: "Sign in" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Sign in to LaughterMaster" }),
      ).toBeInTheDocument();
    });

    it("Post a joke opens the dialog titled Sign in to post a joke", async () => {
      const banner = await renderHeader();
      await userEvent.click(
        within(banner).getByRole("button", { name: "Post a joke" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Sign in to post a joke" }),
      ).toBeInTheDocument();
    });

    it("shows the failed sign-in message when the auth flow reports it", async () => {
      search.value = "signin=failed&sort=new";
      await renderHeader();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sign-in didn't finish. Try again.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(replace).toHaveBeenCalledWith("/?sort=new", { scroll: false });
    });

    it("shows no failure message normally", async () => {
      await renderHeader();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("logged in", () => {
    const leakyUser = {
      id: "u1",
      name: "Mina Park",
      image: null,
      // Not part of SessionUser; proves the header never renders it.
      email: "mina@example.com",
    };

    it("shows the name, initials avatar, Post a joke link and Sign out", async () => {
      mockAuth.mockResolvedValue({ user: leakyUser, expires: "" });
      const banner = await renderHeader();
      expect(banner).toHaveTextContent("Mina Park");
      expect(banner).toHaveTextContent("MP");
      expect(
        within(banner).getByRole("link", { name: "Post a joke" }),
      ).toHaveAttribute("href", "/post");
      const signOut = within(banner).getByRole("button", { name: "Sign out" });
      expect(
        signOut.closest("form")!.querySelector('input[name="redirectTo"]'),
      ).toHaveValue("/");
      expect(within(banner).queryByRole("button", { name: "Sign in" })).toBe(
        null,
      );
    });

    it("shows the profile photo when there is one", async () => {
      mockAuth.mockResolvedValue({
        user: { ...leakyUser, image: "https://example.com/a.png" },
        expires: "",
      });
      const banner = await renderHeader();
      expect(banner.querySelector("img")).toHaveAttribute(
        "src",
        "https://example.com/a.png",
      );
    });

    it("never renders an email", async () => {
      mockAuth.mockResolvedValue({ user: leakyUser, expires: "" });
      await renderHeader();
      expect(document.body.innerHTML).not.toContain("mina@example.com");
      expect(document.body.innerHTML).not.toContain("@example.com");
    });
  });
});

describe("initials", () => {
  it.each([
    ["Mina Park", "MP"],
    ["omar", "O"],
    ["  Ana  Maria Lopez ", "AM"],
    ["", "?"],
  ])("%j -> %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
