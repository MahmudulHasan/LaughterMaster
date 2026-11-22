// Shared auth contracts for M2. The database, auth and UI layers all build
// against these types, so change them only after agreeing with the team.

/** What the session exposes about the signed-in user. Never includes email. */
export type SessionUser = {
  id: string;
  name: string;
  image: string | null;
};

/** A seeded test user for the dev-only sign-in (SPEC D15). */
export type DevUser = {
  /** Stable database user id, e.g. "dev-mina". */
  id: string;
  name: string;
};

/** Which sign-in choices the dialog should offer right now. */
export type SignInOptions = {
  /** True when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set. */
  google: boolean;
  /** Non-empty only in development when Google isn't configured. */
  devUsers: DevUser[];
};

/** Profile data from a sign-in provider, used to create or update a user. */
export type ProviderProfile = {
  /** "google" or "dev". */
  provider: string;
  providerAccountId: string;
  name: string;
  image: string | null;
  /** Stored privately; never returned by public functions. */
  email: string | null;
};

/** The public view of a user. */
export type PublicUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};
