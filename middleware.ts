import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes — no auth required
  const isInvitePage = pathname.startsWith("/invite");
  const isInviteApi = pathname.startsWith("/api/invitations");
  const isAuthPage = pathname.startsWith("/login") || isInvitePage;
  const isSetup = pathname.startsWith("/setup") || pathname.startsWith("/api/setup");
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth || isSetup || isInviteApi) return;

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  // Don't redirect logged-in users away from invite pages — they might be testing the link
  if (isLoggedIn && pathname.startsWith("/login")) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|klient-k.png|klinet-logo-shadow.png|logo.svg).*)"],
};
