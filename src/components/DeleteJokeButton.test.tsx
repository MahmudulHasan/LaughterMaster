import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteJokeAction } from "@/app/joke/actions";

import { DeleteJokeButton } from "./DeleteJokeButton";

vi.mock("@/app/joke/actions", () => ({ deleteJokeAction: vi.fn() }));
const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
const mockAction = deleteJokeAction as unknown as ReturnType<typeof vi.fn>;

describe("DeleteJokeButton", () => {
  beforeEach(() => {
    mockAction.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteJokeButton jokeId="j1" />);

    await user.click(screen.getByRole("button", { name: "Delete this joke" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this joke?" });
    expect(dialog).toHaveTextContent("You can't undo this.");
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("does nothing when cancelled and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<DeleteJokeButton jokeId="j1" />);
    const opener = screen.getByRole("button", { name: "Delete this joke" });

    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockAction).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("deletes on confirm and goes to the given page", async () => {
    mockAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeleteJokeButton jokeId="j1" redirectTo="/" />);

    await user.click(screen.getByRole("button", { name: "Delete this joke" }));
    await user.click(screen.getByRole("button", { name: "Delete joke" }));

    expect(mockAction).toHaveBeenCalledWith("j1");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("refreshes in place when there is no page to go to (lists)", async () => {
    mockAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeleteJokeButton jokeId="j1" />);

    await user.click(screen.getByRole("button", { name: "Delete this joke" }));
    await user.click(screen.getByRole("button", { name: "Delete joke" }));

    expect(refresh).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the dialog open when deleting fails", async () => {
    mockAction.mockResolvedValue({
      ok: false,
      message: "This joke can't be deleted. It may already be gone.",
    });
    const user = userEvent.setup();
    render(<DeleteJokeButton jokeId="j1" redirectTo="/" />);

    await user.click(screen.getByRole("button", { name: "Delete this joke" }));
    await user.click(screen.getByRole("button", { name: "Delete joke" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "It may already be gone.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
