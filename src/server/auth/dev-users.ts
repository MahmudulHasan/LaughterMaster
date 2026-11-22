import type { DevUser } from "./types";

/**
 * Seeded test users for the dev-only sign-in (SPEC D15). Their ids are used
 * as the database user ids, so signing in as one always lands on the same
 * member. Never offered in production (see providers.ts).
 */
export const DEV_USERS: readonly DevUser[] = [
  { id: "dev-mina", name: "Mina Park" },
  { id: "dev-priya", name: "Priya S." },
  { id: "dev-admin", name: "Alex Admin" },
];

export function findDevUser(id: unknown): DevUser | undefined {
  if (typeof id !== "string") return undefined;
  return DEV_USERS.find((user) => user.id === id);
}
