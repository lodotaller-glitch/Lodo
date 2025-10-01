// app/layout.tsx o el layout donde uses <Header />
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Ui/Header";
import ClipLoader from "react-spinners/ClipLoader";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const normalize = (s) => (s === "/" ? "/" : s.replace(/\/+$/, ""));

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const [navLoading, setNavLoading] = useState(false);

  // Cuando cambia la ruta, apagamos el loading
  useEffect(() => {
    if (navLoading) setNavLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <Header
        onNavigateStart={(href) => {
          // 👇 Solo mostramos spinner si el destino es diferente
          if (normalize(pathname) !== normalize(String(href))) {
            setNavLoading(true);
          }
        }}
      />
      {/* aria-busy ayuda a lectores de pantalla */}

      {/* Overlay de carga */}
      {navLoading ? (
        <div className="flex items-center justify-center mt-[35vh]">
          <div className="flex flex-col items-center gap-3">
            <ClipLoader size={38} loading color={BRAND.main} />
            <span className="text-sm font-medium" style={{ color: BRAND.text }}>
              Cargando…
            </span>
          </div>
        </div>
      ) : (
        <main
          className="max-w-7xl mx-auto p-6"
          aria-busy={navLoading ? "true" : "false"}
          // opcional: ocultar el contenido previo para que no “parpadee”
          style={{ visibility: navLoading ? "hidden" : "visible" }}
        >
          {children}
        </main>
      )}
    </>
  );
}
