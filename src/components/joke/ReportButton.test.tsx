import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { reportJokeAction } from "@/server/admin/actions";

import { ReportButton } from "./ReportButton";

vi.mock("@/server/admin/actions", () => ({ reportJokeAction: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({
  signInWithGoogle: vi.fn(),
  signInAsDevUser: vi.fn(),
  signOutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/joke/j1" }));

const mockReport = vi.mocked(reportJokeAction);
const options = { google: true, devUsers: [] };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => mockReport.mockReset());

describe("ReportButton (US-15)", () => {
  it("asks visitors to sign in", async () => {
    render(
      <ReportButton jokeId="j1" state="visitor" signInOptions={options} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Report this joke" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Sign in to report jokes" }),
    ).toBeInTheDocument();
  });

  it("lets a member pick a reason and send it, under StrictMode", async () => {
    mockReport.mockResolvedValue({ ok: true, hidden: false });
    render(
      <StrictMode>
        <ReportButton jokeId="j1" state="member" signInOptions={options} />
      </StrictMode>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Report this joke" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("radio", { name: "Spam" }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /received your report/,
      ),
    );
    const data = mockReport.mock.calls[0]![1] as FormData;
    expect(data.get("jokeId")).toBe("j1");
    expect(data.get("reason")).toBe("Spam");
  });

  it("shows the thank-you note when already reported", () => {
    render(
      <ReportButton jokeId="j1" state="reported" signInOptions={options} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      /received your report/,
    );
  });
});
