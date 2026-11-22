import NextAuth from "next-auth";

import { buildProviders } from "@/server/auth/providers";
import {
  jwtCallback,
  sessionCallback,
  toProviderProfile,
  type AuthDeps,
} from "@/server/auth/session";
import { getAppDb } from "@/server/db/app-db";
import { upsertUserFromProvider } from "@/server/users";

const deps: AuthDeps = {
  getDb: getAppDb,
  upsertUser: upsertUserFromProvider,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildProviders(),
  session: { strategy: "jwt" },
  trustHost: true,
  // Both go to a redirect route that returns the visitor to their page
  // (with `signin=failed` on errors); see src/app/auth/error/route.ts.
  pages: { error: "/auth/error", signIn: "/auth/error" },
  callbacks: {
    // Reject sign-ins we can't map to a member (unknown provider or dev id).
    signIn: ({ account, user, profile }) =>
      account ? toProviderProfile(account, user, profile) !== null : false,
    jwt: (params) => jwtCallback(deps, params),
    session: ({ session, token }) => sessionCallback({ session, token }),
  },
});
