import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "./ShareButton";

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

describe("ShareButton (US-17)", () => {
  it("opens the device share sheet when there is one", async () => {
    const share = vi.fn(async () => {});
    stubNavigator({ share });
    render(<ShareButton jokeId="j 1" text="A joke" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith({
      title: "LaughterMaster",
      text: "A joke",
      url: `${window.location.origin}/joke/j%201`,
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("copies the link and says so when there's no share sheet", async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({
      share: undefined,
      clipboard: { writeText } as unknown as Clipboard,
    });
    render(<ShareButton jokeId="j1" text="A joke" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Link copied"),
    );
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/joke/j1`);
  });

  it("does nothing when the share sheet is closed", async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({
      share: vi.fn(async () => {
        throw new DOMException("closed", "AbortError");
      }),
      clipboard: { writeText } as unknown as Clipboard,
    });
    render(<ShareButton jokeId="j1" text="A joke" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("says when copying fails", async () => {
    stubNavigator({
      share: undefined,
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      } as unknown as Clipboard,
    });
    render(<ShareButton jokeId="j1" text="A joke" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Couldn't copy the link",
      ),
    );
  });
});
