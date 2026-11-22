import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getPostQuota } from "@/server/jokes/jokes";

import { PostJokeBody } from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/app-db", () => ({ getAppDb: vi.fn() }));
vi.mock("@/server/jokes/jokes", () => ({ getPostQuota: vi.fn() }));
vi.mock("@/app/post/actions", () => ({ postJokeAction: vi.fn() }));
vi.mock("@/server/auth/providers", () => ({
  getSignInOptions: () => ({ google: true, devUsers: [] }),
}));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/post" }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockQuota = getPostQuota as unknown as ReturnType<typeof vi.fn>;

describe("/post", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockQuota.mockReset();
  });

  it("asks a logged-out visitor to sign in instead of showing the form", async () => {
    mockAuth.mockResolvedValue(null);
    render(await PostJokeBody());
    expect(
      screen.getByRole("button", { name: "Sign in to post" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mockQuota).not.toHaveBeenCalled();
  });

  it("shows the form with the member's remaining posts", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "dev-mina", name: "Mina", image: null },
    });
    mockQuota.mockResolvedValue({ remaining: 4, retryAt: null });
    render(await PostJokeBody());
    expect(
      screen.getByRole("textbox", { name: "Your joke" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 of 10 posts left today")).toBeInTheDocument();
    expect(mockQuota.mock.calls[0]?.[1]).toBe("dev-mina");
  });
});
