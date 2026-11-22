import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SignInOptions } from "@/server/auth/types";

import { SignInButton } from "./SignInButton";
import { SIGN_IN_TITLES, SignInDialog } from "./SignInDialog";

vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/jokes",
}));

const googleOnly: SignInOptions = { google: true, devUsers: [] };
const devOnly: SignInOptions = {
  google: false,
  devUsers: [
    { id: "dev-mina", name: "Mina" },
    { id: "dev-omar", name: "Omar" },
  ],
};
const none: SignInOptions = { google: false, devUsers: [] };

function renderDialog(
  options: SignInOptions,
  action: keyof typeof SIGN_IN_TITLES = "signin",
) {
  const onClose = vi.fn();
  render(
    <SignInDialog
      action={action}
      options={options}
      redirectTo="/jokes?page=2"
      onClose={onClose}
    />,
  );
  return { onClose, dialog: screen.getByRole("dialog") };
}

describe("SignInDialog", () => {
  it.each([
    ["signin", "Sign in to LaughterMaster"],
    ["post", "Sign in to post a joke"],
    ["like", "Sign in to like jokes"],
    ["dislike", "Sign in to dislike jokes"],
    ["report", "Sign in to report jokes"],
  ] as const)("titles the %s action %j", (action, title) => {
    const { dialog } = renderDialog(googleOnly, action);
    expect(dialog).toHaveAccessibleName(title);
    expect(
      within(dialog).getByRole("heading", { name: title }),
    ).toBeInTheDocument();
  });

  it("opens as a modal and explains why sign-in is needed", () => {
    const { dialog } = renderDialog(googleOnly);
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveTextContent(
      "Reading jokes is free for everyone. To like, dislike or post, sign in with your Google account.",
    );
    expect(dialog).toHaveTextContent(
      "We only show your name and profile photo. Your email is never public.",
    );
  });

  it("shows Continue with Google with the return path when Google is configured", () => {
    const { dialog } = renderDialog(googleOnly);
    const button = within(dialog).getByRole("button", {
      name: "Continue with Google",
    });
    const form = button.closest("form")!;
    expect(form.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/jokes?page=2",
    );
    expect(within(dialog).queryByText("Development only")).toBeNull();
  });

  it("hides the Google button when Google isn't configured", () => {
    const { dialog } = renderDialog(devOnly);
    expect(
      within(dialog).queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
  });

  it("offers a labeled Development only section with one button per dev user", () => {
    const { dialog } = renderDialog(devOnly);
    const section = within(dialog).getByRole("region", {
      name: "Development only",
    });
    const mina = within(section).getByRole("button", {
      name: "Sign in as Mina",
    });
    expect(
      within(section).getByRole("button", { name: "Sign in as Omar" }),
    ).toBeInTheDocument();
    const form = mina.closest("form")!;
    expect(form.querySelector('input[name="userId"]')).toHaveValue("dev-mina");
    expect(form.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/jokes?page=2",
    );
  });

  it("says sign-in isn't configured when there are no options", () => {
    const { dialog } = renderDialog(none);
    expect(dialog).toHaveTextContent(/sign-in isn't configured/i);
    expect(within(dialog).getAllByRole("button")).toHaveLength(1); // Not now
  });

  it("closes on Not now", async () => {
    const { dialog, onClose } = renderDialog(googleOnly);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Not now" }),
    );
    expect(dialog).not.toHaveAttribute("open");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SignInButton", () => {
  it("opens the dialog, returns to the current page, and restores focus on close", async () => {
    window.history.replaceState(null, "", "/jokes?sort=new");
    render(
      <SignInButton action="like" options={googleOnly}>
        Like
      </SignInButton>,
    );
    const opener = screen.getByRole("button", { name: "Like" });
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", {
      name: "Sign in to like jokes",
    });
    expect(dialog.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/jokes?sort=new",
    );

    // Escape in a real browser closes the dialog and fires "close".
    (dialog as HTMLDialogElement).close();
    expect(await screen.findByRole("button", { name: "Like" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Regression: an effect cleanup that called close() made the dialog close
  // itself immediately under React's dev StrictMode (effects run twice).
  it("stays open under StrictMode", async () => {
    render(
      <StrictMode>
        <SignInButton action="post" options={googleOnly}>
          Post a joke
        </SignInButton>
      </StrictMode>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Post a joke" }));
    const dialog = screen.getByRole("dialog", {
      name: "Sign in to post a joke",
    });
    expect(dialog).toHaveAttribute("open");
  });
});
