import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton, shareLinks } from "./ShareButton";

function stubNavigator(nav: Partial<Navigator>) {
  for (const [key, value] of Object.entries(nav)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

afterEach(() => {
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
});

const jokeUrl = (id: string) =>
  `${window.location.origin}/joke/${encodeURIComponent(id)}`;

async function openMenu(id = "j1") {
  render(<ShareButton jokeId={id} text="A joke" />);
  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  return screen.getByRole("menu", { name: "Share this joke" });
}

describe("shareLinks", () => {
  it("builds Facebook, WhatsApp and X links for the joke page", () => {
    const url = "https://laughter-master.vercel.app/joke/j1";
    const links = shareLinks(url, "Why? Because & so.");
    expect(links.facebook).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Flaughter-master.vercel.app%2Fjoke%2Fj1",
    );
    expect(links.whatsapp).toBe(
      "https://wa.me/?text=Why%3F%20Because%20%26%20so.%20https%3A%2F%2Flaughter-master.vercel.app%2Fjoke%2Fj1",
    );
    expect(links.x).toBe(
      "https://x.com/intent/post?text=Why%3F%20Because%20%26%20so.&url=https%3A%2F%2Flaughter-master.vercel.app%2Fjoke%2Fj1",
    );
  });

  it("shortens long jokes in the WhatsApp and X text, never the link", () => {
    const links = shareLinks("https://s.test/joke/j1", "a".repeat(400));
    const x = new URL(links.x);
    expect(x.searchParams.get("text")).toHaveLength(200);
    expect(x.searchParams.get("text")!.endsWith("…")).toBe(true);
    expect(x.searchParams.get("url")).toBe("https://s.test/joke/j1");
  });
});

describe("ShareButton (US-17)", () => {
  it("opens a menu with Facebook, WhatsApp, X and Copy link", async () => {
    const menu = await openMenu("j 1");
    const facebook = within(menu).getByRole("menuitem", {
      name: "Share on Facebook",
    });
    expect(facebook).toHaveAttribute(
      "href",
      shareLinks(jokeUrl("j 1"), "A joke").facebook,
    );
    // New tab, without giving the other site a handle on this page.
    expect(facebook).toHaveAttribute("target", "_blank");
    expect(facebook).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(menu).getByRole("menuitem", { name: "Share on WhatsApp" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Share on X" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers the device share sheet only where there is one", async () => {
    let menu = await openMenu();
    expect(
      within(menu).queryByRole("menuitem", { name: "More options…" }),
    ).toBeNull();
    document.body.innerHTML = "";

    const share = vi.fn(async () => {});
    stubNavigator({ share });
    menu = await openMenu("j 1");
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "More options…" }),
    );
    expect(share).toHaveBeenCalledWith({
      title: "LaughterMaster",
      text: "A joke",
      url: jokeUrl("j 1"),
    });
  });

  it("copies the link and says so", async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Copy link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Link copied"),
    );
    expect(writeText).toHaveBeenCalledWith(jokeUrl("j1"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("says when copying fails", async () => {
    stubNavigator({
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      } as unknown as Clipboard,
    });
    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Copy link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Couldn't copy the link",
      ),
    );
  });

  it("closes on Escape and returns focus to Share", async () => {
    await openMenu();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
  });

  it("closes when clicking outside", async () => {
    await openMenu();
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
