// middleware.js
import { NextResponse } from "next/server";
import { verifyAccessOnEdge } from "@/lib/edgeAuth";

// async function getRole(req) {
//   // Si guardás el rol en una cookie separada:
//   const roleCookie =
//     req.cookies.get("role")?.value || req.cookies.get("rol")?.value;
//   if (roleCookie) return roleCookie;

//   // Preferí SOLO accessToken para autorización de páginas
//   const access = req.cookies.get("refreshToken")?.value;
//   if (!access) return null;

//   const payload = await verifyAccessOnEdge(access);
//   if (!payload) return null;

//   return payload.role;
// }

async function getRole(req) {
  // 1) Si mantienes una cookie auxiliar 'role' (opcional)
  const roleCookie = req.cookies.get("role")?.value;
  if (roleCookie) return roleCookie;

  // 2) Mejor: leer un accessToken en cookie
  const access = req.cookies.get("accessToken")?.value; // <-- no refresh
  (access);
  if (!access) return null;

  const payload = await verifyAccessOnEdge(access);
  (payload, "pa");
  
  return payload?.role || null;
}

export async function middleware(req) {
  // return NextResponse.next();
  const { pathname, origin } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/img/login-bg.webp") ||
    pathname.startsWith("/img/header-bg.png") ||
    pathname.startsWith("/img/logo-3.png");

  const isRoot = pathname === "/";

  const role = await getRole(req); // 👈 ahora async

  if (pathname === "/login" && role) {
    if (role === "student")
      return NextResponse.redirect(new URL("/student", origin));
    if (role === "professor")
      return NextResponse.redirect(new URL("/professor", origin));
    return NextResponse.redirect(new URL("/branches", origin)); // admin/networks
  }

  if (isPublic) return NextResponse.next();

  if (!role && !isRoot) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (isRoot) {
    if (!role) return NextResponse.redirect(new URL("/login", origin));
    if (role === "student")
      return NextResponse.redirect(new URL("/student", origin));
    if (role === "professor")
      return NextResponse.redirect(new URL("/professor", origin));
    return NextResponse.redirect(new URL("/branches", origin)); // admin/networks
  }

  if (role === "student") {
    if (!pathname.startsWith("/student")) {
      return NextResponse.redirect(new URL("/student", origin));
    }
  } else if (role === "professor") {
    if (!pathname.startsWith("/professor")) {
      return NextResponse.redirect(new URL("/professor", origin));
    }
  } else if (role === "admin" || role === "networks") {
    // acceso total
  } else {
    return NextResponse.redirect(new URL("/login", origin));
  }

  (role);
  

  if (!role) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets|images|fonts).*)",
  ],
};
