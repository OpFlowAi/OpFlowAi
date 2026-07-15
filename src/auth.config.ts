import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Edge-compatible base config (no Credentials provider, no bcrypt/Prisma) so
 * middleware - which runs in the Edge runtime - can check auth without
 * pulling in Node-only dependencies. The full config in `auth.ts` extends this.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.accountId = user.accountId;
        token.locationIds = user.locationIds;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        session.user.accountId = token.accountId as string | null;
        session.user.locationIds = token.locationIds as string[];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
