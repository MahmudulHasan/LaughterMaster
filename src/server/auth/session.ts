import type { Account, Profile, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

import type { Db } from "@/server/db/client";
import type { upsertUserFromProvider } from "@/server/users";

import { findDevUser } from "./dev-users";
import { DEV_PROVIDER_ID } from "./providers";
import type { ProviderProfile, SessionUser } from "./types";

declare module "next-auth" {
  // Narrow the session to exactly SessionUser: id, name, image. No email.
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Our database user id (not the provider's account id). */
    uid?: string;
  }
}

export type AuthDeps = {
  getDb: () => Promise<Db>;
  upsertUser: typeof upsertUserFromProvider;
};

/**
 * Map what a provider returned at sign-in to our ProviderProfile, plus the
 * id a brand-new user should get (dev users keep their seeded ids).
 * Returns null for anything we don't recognize, which rejects the sign-in.
 */
export function toProviderProfile(
  account: Pick<Account, "provider" | "providerAccountId">,
  user: Pick<User, "id" | "name" | "email" | "image">,
  profile?: Pick<Profile, "name" | "picture" | "email">,
): { profile: ProviderProfile; id?: string } | null {
  if (account.provider === DEV_PROVIDER_ID) {
    const devUser = findDevUser(user.id);
    if (!devUser) return null;
    return {
      id: devUser.id,
      profile: {
        provider: DEV_PROVIDER_ID,
        providerAccountId: devUser.id,
        name: devUser.name,
        image: null,
        email: null,
      },
    };
  }
  if (account.provider === "google") {
    const picture =
      typeof profile?.picture === "string" ? profile.picture : null;
    return {
      profile: {
        provider: "google",
        providerAccountId: account.providerAccountId,
        name: profile?.name ?? user.name ?? "",
        image: user.image ?? picture,
        email: user.email ?? profile?.email ?? null,
      },
    };
  }
  return null;
}

/**
 * Auth.js `jwt` callback. On sign-in it creates or updates the member and
 * stores only our user id, display name and avatar in the token. Email is
 * removed so it never reaches the cookie or the session.
 */
export async function jwtCallback(
  deps: AuthDeps,
  params: {
    token: JWT;
    user?: User | null;
    account?: Account | null;
    profile?: Profile;
  },
): Promise<JWT | null> {
  const { token, user, account, profile } = params;
  if (account && user) {
    const mapped = toProviderProfile(account, user, profile);
    if (!mapped) return null;
    const db = await deps.getDb();
    const member = await deps.upsertUser(
      db,
      mapped.profile,
      mapped.id ? { id: mapped.id } : undefined,
    );
    return {
      uid: member.id,
      name: member.displayName,
      picture: member.avatarUrl,
      sub: member.id,
    };
  }
  // Not a sign-in: keep the token, minus any email. A token without our id
  // is unusable, and returning null clears the session.
  if (!toSessionUser(token)) return null;
  const { email: _email, ...rest } = token;
  void _email;
  return rest;
}

/** Shape the token into the SessionUser. Only id, name and image. */
export function toSessionUser(token: JWT): SessionUser | null {
  const id = token.uid ?? token.sub;
  if (typeof id !== "string" || id === "") return null;
  return {
    id,
    name: typeof token.name === "string" ? token.name : "",
    image: typeof token.picture === "string" ? token.picture : null,
  };
}

/**
 * Auth.js `session` callback. Builds the session from scratch (not by
 * spreading the default one) so no email can slip through.
 */
export function sessionCallback(params: {
  session: Session;
  token: JWT;
}): Session {
  // jwtCallback drops tokens without our id, so the fallback is unreachable
  // in practice; it only keeps the return type honest.
  const user = toSessionUser(params.token) ?? { id: "", name: "", image: null };
  return { expires: params.session.expires, user };
}
