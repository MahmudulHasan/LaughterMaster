import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("@/auth", () => ({ signIn, signOut }));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

// next-auth's entry imports next/server, which vitest can't resolve outside
// Next. Its AuthError classes are re-exported from @auth/core, so use those.
vi.mock("next-auth", async () => {
  const errors = await import("@auth/core/errors");
  return { AuthError: errors.AuthError };
});

const { CredentialsSignin } = await import("@auth/core/errors");
const { signInAsDevUser, signInWithGoogle, signOutAction } =
  await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_GOOGLE_ID", "");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "");
});

describe("signInAsDevUser", () => {
  it("signs in with the dev provider and a sanitized redirectTo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await signInAsDevUser(form({ userId: "dev-mina", redirectTo: "/jokes" }));
    expect(signIn).toHaveBeenCalledWith("dev", {
      userId: "dev-mina",
      redirectTo: "/jokes",
    });
  });

  it("replaces an off-site redirectTo with /", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await signInAsDevUser(
      form({ userId: "dev-mina", redirectTo: "//evil.com" }),
    );
    expect(signIn).toHaveBeenCalledWith("dev", {
      userId: "dev-mina",
      redirectTo: "/",
    });
  });

  it("returns to the page with signin=failed when Auth.js rejects", async () => {
    vi.stubEnv("NODE_ENV", "development");
    signIn.mockRejectedValue(new CredentialsSignin());
    await expect(
      signInAsDevUser(form({ userId: "nope", redirectTo: "/jokes?x=1" })),
    ).rejects.toMatchObject({ url: "/jokes?x=1&signin=failed" });
  });

  it("refuses outside development without calling Auth.js", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      signInAsDevUser(form({ userId: "dev-mina", redirectTo: "/" })),
    ).rejects.toMatchObject({ url: "/?signin=failed" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("lets the success redirect through", async () => {
    vi.stubEnv("NODE_ENV", "development");
    signIn.mockRejectedValue(new RedirectError("/jokes"));
    await expect(
      signInAsDevUser(form({ userId: "dev-mina", redirectTo: "/jokes" })),
    ).rejects.toMatchObject({ url: "/jokes" });
  });
});

describe("signInWithGoogle", () => {
  it("signs in with Google when configured", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
    await signInWithGoogle(form({ redirectTo: "https://evil.com" }));
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/" });
  });

  it("reports failure when Google isn't configured", async () => {
    await expect(
      signInWithGoogle(form({ redirectTo: "/u/1" })),
    ).rejects.toMatchObject({ url: "/u/1?signin=failed" });
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("signs out to a sanitized redirectTo", async () => {
    await signOutAction(form({ redirectTo: "/jokes" }));
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/jokes" });
    await signOutAction(form({ redirectTo: "//evil.com" }));
    expect(signOut).toHaveBeenLastCalledWith({ redirectTo: "/" });
    await signOutAction(new FormData());
    expect(signOut).toHaveBeenLastCalledWith({ redirectTo: "/" });
  });
});
