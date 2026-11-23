import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJokeAction } from "@/server/jokes/actions";
import { jokeLength } from "@/server/jokes/types";

import { PostJokeForm, lengthHint, lengthState } from "./PostJokeForm";

vi.mock("@/server/jokes/actions", () => ({ createJokeAction: vi.fn() }));
const mockAction = vi.mocked(createJokeAction);

beforeEach(() => {
  mockAction.mockReset();
  mockAction.mockResolvedValue(null);
});

function setup(postsLeft: number | null = 7) {
  render(
    <StrictMode>
      <PostJokeForm postsLeft={postsLeft} />
    </StrictMode>,
  );
  return {
    textarea: screen.getByRole("textbox", { name: "Your joke" }),
    submit: screen.getByRole("button", { name: "Post joke" }),
  };
}

describe("lengthState / lengthHint", () => {
  it.each([
    [0, "empty", "Between 10 and 500 characters."],
    [9, "short", "A bit short… Between 10 and 500 characters."],
    [10, "ok", "Between 10 and 500 characters."],
    [500, "ok", "Between 10 and 500 characters."],
    [501, "long", "Too long… Between 10 and 500 characters."],
  ] as const)("%i graphemes -> %s", (length, state, hint) => {
    expect(lengthState(length)).toBe(state);
    expect(lengthHint(state)).toBe(hint);
  });
});

describe("PostJokeForm", () => {
  it("renders the labeled 6-row textarea, counter, rules and posts left", () => {
    const { textarea, submit } = setup();
    expect(textarea).toHaveAttribute("rows", "6");
    expect(screen.getByText("0 / 500")).toBeInTheDocument();
    expect(textarea).toHaveAccessibleDescription(
      /Between 10 and 500 characters\. 0 \/ 500/,
    );
    expect(submit).toBeDisabled();
    expect(screen.getByText("7 of 10 posts left today")).toBeInTheDocument();
    expect(screen.getByText(/can't edit it/)).toBeInTheDocument();
    expect(screen.getByText(/Any language is welcome/)).toBeInTheDocument();
  });

  it("hides the posts-left line when the count is unknown", () => {
    setup(null);
    expect(screen.queryByText(/posts left today/)).toBeNull();
  });

  it("warns while too short, enables between 10 and 500, warns when too long", async () => {
    const user = userEvent.setup();
    const { textarea, submit } = setup();

    await user.type(textarea, "Too short");
    expect(screen.getByText("9 / 500")).toBeInTheDocument();
    const hint = screen.getByText(/^A bit short…/);
    expect(hint).toHaveClass("text-[#B4400C]");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(submit).toBeDisabled();

    await user.type(textarea, "!");
    expect(screen.getByText("10 / 500")).toBeInTheDocument();
    expect(screen.queryByText(/A bit short/)).toBeNull();
    expect(textarea).not.toHaveAttribute("aria-invalid");
    expect(submit).toBeEnabled();

    await user.clear(textarea);
    await user.click(textarea);
    await user.paste("a".repeat(501));
    expect(screen.getByText("501 / 500")).toBeInTheDocument();
    expect(screen.getByText(/^Too long…/)).toHaveClass("text-[#B4400C]");
    expect(submit).toBeDisabled();
  });

  it("ignores surrounding spaces in the count", async () => {
    const user = userEvent.setup();
    const { textarea, submit } = setup();
    await user.click(textarea);
    await user.paste("     short    ");
    expect(screen.getByText("5 / 500")).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("counts emoji as people see them", async () => {
    const user = userEvent.setup();
    const { textarea, submit } = setup();
    await user.click(textarea);
    await user.paste("👨‍👩‍👧‍👦👍🏽".repeat(5)); // 10 graphemes, 75 code units
    expect(screen.getByText("10 / 500")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    await user.clear(textarea);
    await user.paste("😂".repeat(500));
    expect(screen.getByText("500 / 500")).toBeInTheDocument();
    expect(submit).toBeEnabled();
  });

  it("counts Hindi by grapheme, not code unit", async () => {
    const user = userEvent.setup();
    const { textarea } = setup();
    const text = "नमस्ते दोस्त";
    await user.click(textarea);
    await user.paste(text);
    expect(jokeLength(text)).toBeLessThan(text.length);
    expect(screen.getByText(`${jokeLength(text)} / 500`)).toBeInTheDocument();
  });

  it("submits the text and shows a server error as an alert", async () => {
    mockAction.mockResolvedValue({ error: "too_short" });
    const user = userEvent.setup();
    const { textarea, submit } = setup();
    await user.type(textarea, "A joke about ten words");
    await user.click(submit);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That joke is a bit short.");
    expect(mockAction).toHaveBeenCalledTimes(1);
    const formData = mockAction.mock.calls[0][1];
    expect(formData.get("text")).toBe("A joke about ten words");
    expect(textarea.getAttribute("aria-describedby")).toContain(alert.id);
    expect(textarea).toHaveValue("A joke about ten words");
  });

  it("shows a friendly rate-limit message with the retry time", async () => {
    mockAction.mockResolvedValue({
      error: "rate_limited",
      retryAt: "2026-11-23T09:05:00.000Z",
    });
    const user = userEvent.setup();
    const { textarea, submit } = setup(0);
    await user.type(textarea, "One more joke please");
    await user.click(submit);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You've posted 10 jokes in the last 24 hours.",
    );
    const expected = new Intl.DateTimeFormat("en", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date("2026-11-23T09:05:00.000Z"));
    expect(alert).toHaveTextContent(`You can post again at ${expected}.`);
  });

  it("asks to sign in again when the session ended", async () => {
    mockAction.mockResolvedValue({ error: "not_signed_in" });
    const user = userEvent.setup();
    const { textarea, submit } = setup();
    await user.type(textarea, "A joke about ten words");
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sign in again/);
  });

  it("disables the button while posting", async () => {
    let resolve: (value: null) => void = () => {};
    mockAction.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const { textarea } = setup();
    await user.type(textarea, "A joke about ten words");
    await user.click(screen.getByRole("button", { name: "Post joke" }));
    const posting = await screen.findByRole("button", { name: "Posting…" });
    expect(posting).toBeDisabled();
    resolve(null);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Post joke" })).toBeEnabled(),
    );
  });
});
