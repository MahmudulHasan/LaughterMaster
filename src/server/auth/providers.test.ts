import { describe, expect, it } from "vitest";

import { DEV_USERS } from "./dev-users";
import {
  authorizeDevUser,
  buildProviders,
  DEV_PROVIDER_ID,
  getSignInOptions,
  type AuthEnv,
} from "./providers";

const google = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" };
const dev: AuthEnv = { NODE_ENV: "development" };
const prod: AuthEnv = { NODE_ENV: "production" };

// Same lookup Auth.js's signIn() uses: a user-set id lives under `options`.
function providerIds(env: AuthEnv): string[] {
  return buildProviders(env).map((provider) => {
    const config = typeof provider === "function" ? provider() : provider;
    const { options } = config as { options?: { id?: string } };
    return options?.id ?? config.id;
  });
}

describe("getSignInOptions / buildProviders", () => {
  it("offers the dev sign-in in development without Google", () => {
    expect(getSignInOptions(dev)).toEqual({
      google: false,
      devUsers: [...DEV_USERS],
    });
    expect(providerIds(dev)).toEqual([DEV_PROVIDER_ID]);
  });

  it("never registers the dev sign-in in production", () => {
    expect(getSignInOptions(prod)).toEqual({ google: false, devUsers: [] });
    expect(providerIds(prod)).toEqual([]);
    expect(providerIds({ ...prod, ...google })).toEqual(["google"]);
  });

  it("never registers the dev sign-in in tests or with no NODE_ENV", () => {
    expect(providerIds({ NODE_ENV: "test" })).toEqual([]);
    expect(providerIds({})).toEqual([]);
  });

  it("drops the dev sign-in when Google is configured", () => {
    const env = { ...dev, ...google };
    expect(getSignInOptions(env)).toEqual({ google: true, devUsers: [] });
    expect(providerIds(env)).toEqual(["google"]);
  });

  it("registers Google only when both variables are set", () => {
    expect(providerIds({ ...prod, AUTH_GOOGLE_ID: "id" })).toEqual([]);
    expect(providerIds({ ...prod, AUTH_GOOGLE_SECRET: "s" })).toEqual([]);
    expect(
      providerIds({ ...prod, AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "s" }),
    ).toEqual([]);
    expect(getSignInOptions({ ...prod, AUTH_GOOGLE_ID: "id" }).google).toBe(
      false,
    );
  });

  it("seeds the three dev users", () => {
    expect(DEV_USERS.map((user) => user.id)).toEqual([
      "dev-mina",
      "dev-priya",
      "dev-admin",
    ]);
  });
});

describe("authorizeDevUser", () => {
  it("accepts a seeded dev user id", () => {
    expect(authorizeDevUser({ userId: "dev-mina" }, dev)).toEqual({
      id: "dev-mina",
      name: "Mina Park",
      image: null,
    });
  });

  it("rejects unknown, missing or non-string ids", () => {
    expect(authorizeDevUser({ userId: "dev-nobody" }, dev)).toBeNull();
    expect(authorizeDevUser({ userId: "" }, dev)).toBeNull();
    expect(authorizeDevUser({ userId: ["dev-mina"] }, dev)).toBeNull();
    expect(authorizeDevUser({}, dev)).toBeNull();
    expect(authorizeDevUser(undefined, dev)).toBeNull();
  });

  it("rejects even a seeded id outside development or with Google", () => {
    expect(authorizeDevUser({ userId: "dev-mina" }, prod)).toBeNull();
    expect(
      authorizeDevUser({ userId: "dev-mina" }, { ...dev, ...google }),
    ).toBeNull();
  });

  it("is what the registered dev provider uses", async () => {
    const [provider] = buildProviders(dev);
    const config = typeof provider === "function" ? provider() : provider;
    // Credentials() keeps the user's config under `options`.
    type Authorize = (credentials: Record<string, unknown>) => unknown;
    const { options } = config as { options?: { authorize?: Authorize } };
    const authorize = options?.authorize;
    if (!authorize) throw new Error("dev provider has no authorize");
    expect(await authorize({ userId: "dev-priya" })).toMatchObject({
      id: "dev-priya",
    });
    expect(await authorize({ userId: "evil" })).toBeNull();
  });
});
