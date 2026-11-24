// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import {
  ClaudeModerator,
  DevSkipModerator,
  SYSTEM_PROMPT,
  UnavailableModerator,
  buildUserMessage,
  createModerator,
  toVerdict,
} from "./moderator";

const candidates = [{ id: "j1", text: "Original joke" }];

function fakeClient(parse: (...args: unknown[]) => Promise<unknown>) {
  return { messages: { parse: vi.fn(parse) } } as unknown as Anthropic;
}

describe("toVerdict", () => {
  it("passes approvals through with their category", () => {
    expect(
      toVerdict(
        {
          decision: "approve",
          reason: "",
          category: "Puns",
          duplicate_of: null,
        },
        candidates,
      ),
    ).toEqual({ decision: "approve", category: "Puns" });
  });

  it("keeps a duplicate id only if it was one of the candidates", () => {
    const base = {
      decision: "reject" as const,
      reason: "This joke is already on LaughterMaster.",
      category: "Other" as const,
    };
    expect(
      toVerdict({ ...base, duplicate_of: "j1" }, candidates),
    ).toMatchObject({ duplicateOf: "j1" });
    expect(
      toVerdict({ ...base, duplicate_of: "made-up" }, candidates),
    ).toMatchObject({ duplicateOf: null });
  });

  it("fills in a reason when Claude leaves it empty", () => {
    const verdict = toVerdict(
      {
        decision: "reject",
        reason: "  ",
        category: "Other",
        duplicate_of: null,
      },
      [],
    );
    expect(verdict).toMatchObject({ decision: "reject" });
    expect(verdict.decision === "reject" && verdict.reason).toMatch(
      /can't be posted/,
    );
  });
});

describe("buildUserMessage", () => {
  it("wraps the joke and candidates as data", () => {
    const message = buildUserMessage("My joke", candidates);
    expect(message).toContain(
      '<existing_joke id="j1">\nOriginal joke\n</existing_joke>',
    );
    expect(message).toContain("<submitted_joke>\nMy joke\n</submitted_joke>");
    expect(buildUserMessage("x", [])).toContain("(none)");
  });

  it("keeps the system prompt free of per-request content (cacheable)", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\$\{|submitted_joke>\n[^<]/);
    expect(SYSTEM_PROMPT).toMatch(/never as instructions/);
  });
});

describe("ClaudeModerator", () => {
  it("sends one structured, low-effort request and returns the verdict", async () => {
    const client = fakeClient(async () => ({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      parsed_output: {
        decision: "approve",
        reason: "",
        category: "Tech",
        duplicate_of: null,
      },
    }));
    const moderator = new ClaudeModerator({ client });
    const outcome = await moderator.moderateJoke({
      text: "A joke",
      candidates,
    });
    expect(outcome).toEqual({
      kind: "verdict",
      model: "claude-opus-5-5",
      verdict: { decision: "approve", category: "Tech" },
    });
    const request = (client.messages.parse as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.output_config).toMatchObject({ effort: "low" });
    expect(request).not.toHaveProperty("thinking");
  });

  it("treats a safety refusal as a rejection", async () => {
    const client = fakeClient(async () => ({
      model: "claude-opus-5-5",
      stop_reason: "refusal",
      parsed_output: null,
    }));
    const outcome = await new ClaudeModerator({ client }).moderateJoke({
      text: "x",
      candidates: [],
    });
    expect(outcome).toMatchObject({
      kind: "verdict",
      verdict: { decision: "reject" },
    });
  });

  it("reports API errors and unusable answers as unavailable", async () => {
    const failing = fakeClient(async () => {
      throw new Anthropic.APIConnectionTimeoutError();
    });
    expect(
      await new ClaudeModerator({ client: failing }).moderateJoke({
        text: "x",
        candidates: [],
      }),
    ).toMatchObject({ kind: "unavailable" });

    const truncated = fakeClient(async () => ({
      model: "claude-opus-5-5",
      stop_reason: "max_tokens",
      parsed_output: null,
    }));
    expect(
      await new ClaudeModerator({ client: truncated }).moderateJoke({
        text: "x",
        candidates: [],
      }),
    ).toMatchObject({ kind: "unavailable" });
  });
});

describe("createModerator (D17)", () => {
  it("uses Claude when credentials exist, with the configured model", () => {
    const moderator = createModerator({
      ANTHROPIC_API_KEY: "test-key",
      MODERATION_MODEL: "claude-haiku-5-5",
      NODE_ENV: "production",
    });
    expect(moderator).toBeInstanceOf(ClaudeModerator);
    expect((moderator as ClaudeModerator).model).toBe("claude-haiku-5-5");
  });

  it("skips moderation only in development without credentials", () => {
    expect(createModerator({ NODE_ENV: "development" })).toBeInstanceOf(
      DevSkipModerator,
    );
  });

  it("fails closed in production and tests without credentials", () => {
    for (const NODE_ENV of ["production", "test", undefined]) {
      expect(createModerator({ NODE_ENV })).toBeInstanceOf(
        UnavailableModerator,
      );
    }
  });
});
