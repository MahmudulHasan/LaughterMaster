import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { postJokeAction } from "@/app/post/actions";

import { PostJokeForm } from "./PostJokeForm";

vi.mock("@/app/post/actions", () => ({ postJokeAction: vi.fn() }));
const mockAction = postJokeAction as unknown as ReturnType<typeof vi.fn>;

const field = () => screen.getByRole("textbox", { name: "Your joke" });
const submit = () => screen.getByRole("button", { name: "Post joke" });

describe("PostJokeForm", () => {
  beforeEach(() => {
    mockAction.mockReset();
  });

  it("counts trimmed graphemes and keeps Post disabled under 10", async () => {
    const user = userEvent.setup();
    render(<PostJokeForm remaining={10} retryAt={null} />);

    expect(submit()).toBeDisabled();
    await user.type(field(), "  👨‍👩‍👧abc  ");
    expect(screen.getByText("4 / 500")).toBeInTheDocument();
    expect(
      screen.getByText("A bit short. Jokes need at least 10 characters."),
    ).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(submit()).toBeDisabled();
  });

  it("warns and disables Post above 500 characters", async () => {
    const user = userEvent.setup();
    render(<PostJokeForm remaining={10} retryAt={null} />);
    await user.click(field());
    await user.paste("a".repeat(501));
    expect(
      screen.getByText("Too long. Trim it to 500 characters or fewer."),
    ).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it("shows how many posts are left today", () => {
    render(<PostJokeForm remaining={7} retryAt={null} />);
    expect(screen.getByText("7 of 10 posts left today")).toBeInTheDocument();
  });

  it("posts, clears the field and links to the new joke", async () => {
    mockAction.mockResolvedValue({
      status: "posted",
      jokeId: "joke-1",
      remaining: 6,
    });
    const user = userEvent.setup();
    render(<PostJokeForm remaining={7} retryAt={null} />);

    await user.type(field(), "Why did the chicken cross the road?");
    await user.click(submit());

    expect(await screen.findByText("Your joke is live!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your joke" })).toHaveAttribute(
      "href",
      "/joke/joke-1",
    );
    expect(field()).toHaveValue("");
    expect(screen.getByText("6 of 10 posts left today")).toBeInTheDocument();
    const sent = mockAction.mock.calls[0]?.[1] as FormData;
    expect(sent.get("text")).toBe("Why did the chicken cross the road?");
  });

  it("keeps the text and shows the server's message on an error", async () => {
    mockAction.mockResolvedValue({
      status: "error",
      message: "Sign in to post a joke.",
    });
    const user = userEvent.setup();
    render(<PostJokeForm remaining={10} retryAt={null} />);

    await user.type(field(), "A joke that won't post");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in to post a joke.",
    );
    expect(field()).toHaveValue("A joke that won't post");
  });

  it("says when posting reopens after hitting the limit", async () => {
    const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    mockAction.mockResolvedValue({
      status: "rate_limited",
      retryAt: retryAt.toISOString(),
    });
    const user = userEvent.setup();
    render(<PostJokeForm remaining={1} retryAt={null} />);

    await user.type(field(), "My eleventh joke today");
    await user.click(submit());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You've posted 10 jokes in the last 24 hours",
    );
    expect(alert).toHaveTextContent(
      retryAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
    expect(submit()).toBeDisabled();
  });

  it("starts blocked when the member is already at the limit", () => {
    const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(<PostJokeForm remaining={0} retryAt={retryAt} />);
    expect(screen.getByRole("alert")).toHaveTextContent("You can post again");
    expect(submit()).toBeDisabled();
  });
});
