import { describe, expect, it } from "vitest";

import {
  callbackUrlToPath,
  safeRedirectPath,
  signInFailedRedirectPath,
  withSignInFailed,
} from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/jokes", "/jokes?x=1", "/u/abc#top"])("keeps %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "javascript:alert(1)",
    "jokes",
    "",
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });

  it("rejects non-strings (e.g. a File from FormData)", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath(new Blob(["/x"]))).toBe("/");
  });
});

describe("callbackUrlToPath", () => {
  it("keeps only the path of an absolute URL", () => {
    expect(callbackUrlToPath("http://localhost:3000/jokes?x=1")).toBe(
      "/jokes?x=1",
    );
    expect(callbackUrlToPath("https://evil.com/steal")).toBe("/steal");
    expect(callbackUrlToPath("http%3A%2F%2Flocalhost%3A3000%2Fjokes")).toBe(
      "/jokes",
    );
  });

  it("rejects unusable values", () => {
    expect(callbackUrlToPath("javascript:alert(1)")).toBeNull();
    expect(callbackUrlToPath("//evil.com")).toBeNull();
    expect(callbackUrlToPath("not a url")).toBeNull();
    expect(callbackUrlToPath(undefined)).toBeNull();
  });
});

describe("withSignInFailed", () => {
  it("appends signin=failed and keeps other params", () => {
    expect(withSignInFailed("/")).toBe("/?signin=failed");
    expect(withSignInFailed("/jokes?x=1")).toBe("/jokes?x=1&signin=failed");
    expect(withSignInFailed("/jokes?signin=failed")).toBe(
      "/jokes?signin=failed",
    );
    expect(withSignInFailed("/u/1#a")).toBe("/u/1?signin=failed#a");
  });

  it("falls back to home for unsafe paths", () => {
    expect(withSignInFailed("//evil.com")).toBe("/?signin=failed");
  });
});

describe("signInFailedRedirectPath", () => {
  const noCookies = () => undefined;

  it("prefers the callbackUrl query param", () => {
    expect(
      signInFailedRedirectPath({
        callbackUrl: "/jokes",
        getCookie: () => "http://localhost:3000/u/1",
      }),
    ).toBe("/jokes?signin=failed");
  });

  it("falls back to Auth.js's callback cookie, then home", () => {
    expect(
      signInFailedRedirectPath({
        callbackUrl: null,
        getCookie: (name) =>
          name === "authjs.callback-url"
            ? "http://localhost:3000/u/1?tab=a"
            : undefined,
      }),
    ).toBe("/u/1?tab=a&signin=failed");
    expect(
      signInFailedRedirectPath({ callbackUrl: null, getCookie: noCookies }),
    ).toBe("/?signin=failed");
  });

  it("never sends the visitor off-site or back into auth routes", () => {
    expect(
      signInFailedRedirectPath({
        callbackUrl: "//evil.com",
        getCookie: noCookies,
      }),
    ).toBe("/?signin=failed");
    expect(
      signInFailedRedirectPath({
        callbackUrl: "/auth/error",
        getCookie: noCookies,
      }),
    ).toBe("/?signin=failed");
    expect(
      signInFailedRedirectPath({
        callbackUrl: "/api/auth/signin",
        getCookie: noCookies,
      }),
    ).toBe("/?signin=failed");
  });

  it("omits the failed flag when there is no error param", () => {
    expect(
      signInFailedRedirectPath({
        callbackUrl: "/jokes",
        getCookie: noCookies,
        error: null,
      }),
    ).toBe("/jokes");
    expect(
      signInFailedRedirectPath({
        callbackUrl: "/jokes",
        getCookie: noCookies,
        error: "CredentialsSignin",
      }),
    ).toBe("/jokes?signin=failed");
  });
});
