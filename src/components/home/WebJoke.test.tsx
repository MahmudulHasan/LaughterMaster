import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebJoke = vi.fn();
vi.mock("@/server/webJoke/getWebJoke", () => ({ getWebJoke }));

const { WebJoke } = await import("./WebJoke");

beforeEach(() => getWebJoke.mockReset());

describe("WebJoke (US-19)", () => {
  it("shows the joke, labelled as from the web, with credit", async () => {
    getWebJoke.mockResolvedValue({
      id: "abc",
      text: "I only know 25 letters of the alphabet. I don't know y.",
      url: "https://icanhazdadjoke.com/j/abc",
    });
    render((await WebJoke())!);
    expect(
      screen.getByRole("heading", { name: "Joke from the web" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "I only know 25 letters of the alphabet. I don't know y.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/not part of the top 10/i)).toBeInTheDocument();
    const credit = screen.getByRole("link", { name: /icanhazdadjoke\.com/ });
    expect(credit).toHaveAttribute("href", "https://icanhazdadjoke.com/j/abc");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows text as text, never as HTML", async () => {
    getWebJoke.mockResolvedValue({
      id: "x",
      text: "<b>bold</b> <img src=x onerror=alert(1)>",
      url: "https://icanhazdadjoke.com/j/x",
    });
    const { container } = render((await WebJoke())!);
    expect(container.querySelector("img, b")).toBeNull();
    expect(container).toHaveTextContent("<b>bold</b>");
  });

  it("shows nothing when there's no joke", async () => {
    getWebJoke.mockResolvedValue(null);
    expect(await WebJoke()).toBeNull();
  });
});
