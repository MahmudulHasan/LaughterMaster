import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteJokeAction } from "@/server/jokes/actions";

import { DeleteJokeButton } from "./DeleteJokeButton";

vi.mock("@/server/jokes/actions", () => ({ deleteJokeAction: vi.fn() }));
const mockDelete = vi.mocked(deleteJokeAction);

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

beforeEach(() => {
  mockDelete.mockReset();
  mockDelete.mockResolvedValue(undefined);
});

function setup() {
  render(
    <StrictMode>
      <DeleteJokeButton jokeId="j-1" />
    </StrictMode>,
  );
  return screen.getByRole("button", { name: "Delete" });
}

describe("DeleteJokeButton", () => {
  it("uses admin wording when an admin deletes someone else's joke", async () => {
    render(<DeleteJokeButton jokeId="j-1" asAdmin />);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete (admin)" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Delete this member's joke?" }),
    ).toHaveAccessibleDescription(/as an admin/);
  });

  it("asks for confirmation before deleting, and stays open under StrictMode", async () => {
    const opener = setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Delete this joke?" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription(/can't be undone/);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("Cancel closes without deleting and returns focus", async () => {
    const opener = setup();
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("confirming posts the joke id to deleteJokeAction", async () => {
    await userEvent.click(setup());
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete joke",
      }),
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete.mock.calls[0][0].get("jokeId")).toBe("j-1");
  });
});
