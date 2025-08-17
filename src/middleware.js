// middleware.js
import { NextResponse } from "next/server";

export function middleware(request) {
  // const token = request.cookies.get("refreshToken")?.value;
  // const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  // if (!token && !isAuthPage) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }
  return NextResponse.next();
}

export const config = {
  matcher: ["/","/protected/:path*"],
};
