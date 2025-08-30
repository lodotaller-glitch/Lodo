// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  // const token = request.cookies.get("refreshToken")?.value;
  // const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  // if (!token && !isAuthPage) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/protected/:path*"],
};
