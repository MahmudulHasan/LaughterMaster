import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { DEV_USERS, findDevUser } from "./dev-users";
import type { DevUser, SignInOptions } from "./types";

/** The environment variables sign-in depends on. `process.env` fits. */
export type AuthEnv = Readonly<Record<string, string | undefined>>;

/** Provider id of the dev-only test sign-in. */
export const DEV_PROVIDER_ID = "dev";

export function isGoogleConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

/**
 * The dev sign-in exists only in `next dev` without a Google client (D15).
 * `next build`/`next start` set NODE_ENV=production, so it can never be
 * registered in a production build.
 */
export function isDevSignInEnabled(env: AuthEnv = process.env): boolean {
  return env.NODE_ENV === "development" && !isGoogleConfigured(env);
}

/** Which sign-in choices the dialog should offer right now. Server-only. */
export function getSignInOptions(env: AuthEnv = process.env): SignInOptions {
  return {
    google: isGoogleConfigured(env),
    devUsers: isDevSignInEnabled(env) ? [...DEV_USERS] : [],
  };
}

/** The user object the dev provider hands to Auth.js. */
export type DevAuthorizedUser = { id: string; name: string; image: null };

/**
 * `authorize` for the dev provider: accepts only a seeded dev user id, and
 * re-checks the environment so it fails closed even if mis-registered.
 */
export function authorizeDevUser(
  credentials: Partial<Record<string, unknown>> | undefined,
  env: AuthEnv = process.env,
): DevAuthorizedUser | null {
  if (!isDevSignInEnabled(env)) return null;
  const devUser: DevUser | undefined = findDevUser(credentials?.userId);
  if (!devUser) return null;
  return { id: devUser.id, name: devUser.name, image: null };
}

/** Build the Auth.js provider list for the given environment. */
export function buildProviders(env: AuthEnv = process.env): Provider[] {
  const providers: Provider[] = [];
  if (isGoogleConfigured(env)) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      }),
    );
  }
  if (isDevSignInEnabled(env)) {
    providers.push(
      Credentials({
        id: DEV_PROVIDER_ID,
        name: "Dev test users",
        credentials: { userId: {} },
        authorize: (credentials) => authorizeDevUser(credentials, env),
      }),
    );
  }
  return providers;
}
