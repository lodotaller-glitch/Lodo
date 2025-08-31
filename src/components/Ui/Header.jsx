"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function NavItem({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
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

export default function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = useMemo(() => {
    const common = [];
    if (!user) return common;

    switch (user.role) {
      case "admin":
        return [
          ...common,
          { href: `/${user?.branch}`, label: "Inicio" },
          { href: `/${user.branch}/students`, label: "Estudiantes" },
          { href: `/${user.branch}/professors`, label: "Profesores" },
          { href: `/${user.branch}/networks`, label: "Redes" },
        ];
      case "networks":
        return [
          ...common,
          { href: `/${user?.branch}`, label: "Inicio" },
          { href: `/${user.branch}/students/new`, label: "Nuevo Estudiante" },
          { href: `/${user.branch}/asignaciones`, label: "Asignaciones" },
        ];
      case "professor":
        return [
          ...common,
          { href: `/professor`, label: "Inicio" },
          {
            href: `/${user.branch}/calendario/profesor`,
            label: "Mi Calendario",
          },
        ];
      case "student":
        return [
          ...common,
          { href: `/student`, label: "Inicio" },
          { href: `/student/profile`, label: "Perfil" },
        ];
      default:
        return common;
    }
  }, [user]);

  return (
    <header
      className="sticky top-0 z-40 border-b border-black/5"
      style={{ background: BRAND.main }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              href={`/${user?.branch}`}
              className="inline-flex items-center gap-2"
            >
              <span
                className="inline-block w-8 h-8 rounded-xl"
                style={{ background: BRAND.soft }}
              />
              <span className="text-white font-semibold tracking-wide">
                Academia
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavItem key={l.href} href={l.href} label={l.label} />
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
                  onClick={logout}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                  title="Cerrar sesión"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
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
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden" style={{ background: BRAND.main }}>
          <div className="px-4 pb-4 space-y-2">
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <NavItem key={l.href} href={l.href} label={l.label} />
              ))}
            </nav>
            <div className="pt-2 border-t border-white/10">
              {user ? (
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Cerrar sesión
                </button>
              ) : (
                <Link
                  href="/login"
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
