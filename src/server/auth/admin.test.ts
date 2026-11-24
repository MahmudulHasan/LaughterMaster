// @vitest-environment node
import { describe, expect, it } from "vitest";

import { adminUserIds, isAdmin } from "./admin";

describe("isAdmin (D4)", () => {
  const env = { ADMIN_USER_IDS: " dev-admin , u-42,, " };

  it("reads a trimmed, comma-separated id list", () => {
    expect(adminUserIds(env)).toEqual(new Set(["dev-admin", "u-42"]));
  });

  it("is true only for listed ids", () => {
    expect(isAdmin("dev-admin", env)).toBe(true);
    expect(isAdmin("dev-mina", env)).toBe(false);
    expect(isAdmin(null, env)).toBe(false);
    expect(isAdmin("", env)).toBe(false);
  });

  it("has no admins when the variable is unset", () => {
    expect(isAdmin("dev-admin", {})).toBe(false);
  });
});
