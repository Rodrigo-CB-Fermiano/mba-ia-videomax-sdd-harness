import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/library/:path*",
    "/video/:path*",
    "/upload/:path*",
    "/search/:path*",
  ],
};
