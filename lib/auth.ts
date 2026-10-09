import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { clearFailures, isLimited, recordFailure } from "@/lib/rate-limit";

const LOGIN_MAX_FAILURES = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const limitKey = `login:${(credentials.email as string).trim().toLowerCase()}`;
        if (isLimited(limitKey, LOGIN_MAX_FAILURES)) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        const isValid =
          !!user?.password &&
          user.active &&
          (await compare(credentials.password as string, user.password));
        if (!user || !isValid) {
          recordFailure(limitKey, LOGIN_WINDOW_MS);
          return null;
        }
        clearFailures(limitKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image ? `/api/users/${user.id}/avatar` : null,
        };
      },
    }),
  ],
});
