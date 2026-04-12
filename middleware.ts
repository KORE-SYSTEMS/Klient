import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes — no auth required
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/invite");
  const isSetup = pathname.startsWith("/setup") || pathname.startsWith("/api/setup");
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth || isSetup) return;

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|klinet-logo-shadow.png|logo.svg).*)"],
};
