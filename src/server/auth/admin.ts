// Admins are the member ids listed in ADMIN_USER_IDS (SPEC D4), e.g.
// "dev-admin" locally. Server-only: never trust an admin flag from a client.

type Env = Record<string, string | undefined>;

export function adminUserIds(env: Env = process.env): Set<string> {
  return new Set(
    (env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isAdmin(
  userId: string | null | undefined,
  env: Env = process.env,
): boolean {
  return Boolean(userId) && adminUserIds(env).has(userId!);
}
