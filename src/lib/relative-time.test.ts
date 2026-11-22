import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

const now = new Date("2026-11-22T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [MIN, "1m ago"],
    [59 * MIN, "59m ago"],
    [HOUR, "1h ago"],
    [3 * HOUR + 20 * MIN, "3h ago"],
    [23 * HOUR + 59 * MIN, "23h ago"],
    [DAY, "1d ago"],
    [6 * DAY, "6d ago"],
  ])("%i ms ago reads %j", (ms, expected) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(expected);
  });

  it("shows a date after a week, with the year only when it differs", () => {
    expect(formatRelativeTime(new Date("2026-11-10T09:00:00Z"), now)).toBe(
      "Nov 10",
    );
    expect(formatRelativeTime(new Date("2025-12-31T09:00:00Z"), now)).toBe(
      "Dec 31, 2025",
    );
  });

  it("treats a slightly future time (clock skew) as just now", () => {
    expect(formatRelativeTime(new Date(now.getTime() + 5000), now)).toBe(
      "just now",
    );
  });
});
