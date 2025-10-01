// components/Ui/Header.tsx
"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function NavItem({ href, label, onSelect, onNavigateStart }) {
  const pathname = usePathname() || "/";

  const normalize = (s) => (s === "/" ? "/" : s.replace(/\/+$/, ""));
  const current = normalize(pathname);
  const target = normalize(href);
  const linkDepth =
    target === "/" ? 0 : target.split("/").filter(Boolean).length;
  const isHomeLike = linkDepth <= 1;
  const active = isHomeLike
    ? current === target
    : current === target || current.startsWith(target + "/");

  return (
    <Link
      href={href}
      onClick={(e) => {
        // Disparamos el overlay de carga
        onNavigateStart?.(href);
        onSelect?.();
      }}
      className={`px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
        active
          ? "bg-[#DDD7C9] text-[#1F1C19]"
          : "text-white/90 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Header({ onNavigateStart }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { branchId } = useParams();
  const pathname = usePathname() || "/";

  const links = useMemo(() => {
    const common = [];
    if (!user) return common;
    if (pathname === "/branches") return common;
    switch (user.role) {
      case "admin":
        return [
          ...common,
          { href: `/${branchId}`, label: "Inicio" },
          { href: `/${branchId}/students`, label: "Estudiantes" },
          { href: `/${branchId}/professors`, label: "Profesores" },
          { href: `/${branchId}/networks`, label: "Redes" },
          { href: `/${branchId}/payments`, label: "Pagos" },
          { href: `/branches`, label: "Sucursales" },
        ];
      case "networks":
        return [
          ...common,
          { href: `/${user?.branch}`, label: "Inicio" },
          { href: `/${user?.branch}/students`, label: "Estudiantes" },
        ];
      case "professor":
        return [
          ...common,
          { href: `/professor`, label: "Inicio" },
          { href: `/professor/students`, label: "Estudiantes" },
          { href: `/professor/profile`, label: "Perfil" },
        ];
      case "student":
        return [
          ...common,
          { href: `/student`, label: "Inicio" },
          { href: `/student/profile`, label: "Perfil" },
          { href: `/student/pieces`, label: "Piezas" },
        ];
      default:
        return common;
    }
  }, [user, branchId, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 header-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              href={`/${user?.branch ?? ""}`}
              onClick={() => onNavigateStart?.()}
              className="inline-flex items-center gap-2"
            >
              <Image src={"/img/logo-3.png"} width={30} height={30} alt="" />
              <span className="text-white font-semibold tracking-wide">
                Taller De Ceramica
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavItem
                key={l.href}
                href={l.href}
                label={l.label}
                onNavigateStart={onNavigateStart}
              />
            ))}
          </nav>

          {/* User menu */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-white/90">
                  <div className="font-medium leading-5">{user.name}</div>
                  <div className="text-white/70 leading-4 capitalize">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={() => {
                    onNavigateStart?.();
                    logout();
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                  title="Cerrar sesión"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => onNavigateStart?.()}
                className="px-3 py-2 rounded-xl bg-white text-[#1F1C19]"
              >
                Ingresar
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-white hover:bg-white/10"
            aria-label="Abrir menú"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden"
          style={{ background: BRAND.main }}
        >
          <div className="px-4 pb-4 space-y-2">
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <NavItem
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  onNavigateStart={() => onNavigateStart?.()}
                  onSelect={() => setOpen(false)}
                />
              ))}
            </nav>
            <div className="pt-2 border-t border-white/10">
              {user ? (
                <button
                  onClick={() => {
                    onNavigateStart?.();
                    setOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Cerrar sesión
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => {
                    onNavigateStart?.();
                    setOpen(false);
                  }}
                  className="block px-3 py-2 rounded-xl bg-white text-[#1F1C19]"
                >
                  Ingresar
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
