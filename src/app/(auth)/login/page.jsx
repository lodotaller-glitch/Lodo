// app/login/page.jsx
"use client";
import { useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
// Cambiá esta ruta por la imagen que quieras usar de fondo
const BG_URL = "/img/login-bg.jpg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setAccessToken, setUser } = useAuth();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAccessToken(data.accessToken);
      const { user } = data;
      setUser(user);
      switch (user.role) {
        case "admin":
          router.push("/branches");
          break;
        case "student":
          router.push("/student");
          break;
        case "professor":
          router.push("/professor");
          break;
        case "networks":
          router.push("/branches");
          break;
        default:
          break;
      }
    } catch {
      alert("Credenciales inválidas");
    }
  }

  return (
    <main className=" login-bg min-h-screen flex items-center justify-center px-4 py-8">
      {/* Card */}
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-2xl border shadow-2xl p-6 sm:p-8 backdrop-blur-md bg-white/80"
        style={{ borderColor: "rgba(255,255,255,.5)" }}
      >
        {/* Encabezado */}
        <div className="mb-6 text-center">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: BRAND.text }}
          >
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm" style={{ color: `${BRAND.text}99` }}>
            Accedé a tu cuenta del taller
          </p>
        </div>

        {/* Email */}
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Email
          </label>
          <input
            className="w-full rounded-xl border bg-white/90 px-3 py-2.5 shadow-sm outline-none transition focus:ring-2"
            style={{
              borderColor: BRAND.soft,
              color: BRAND.text,
              boxShadow: "0 1px 1px rgba(0,0,0,.04)",
            }}
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </div>

        {/* Password */}
        <div className="mt-4">
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Contraseña
          </label>
          <input
            className="w-full rounded-xl border bg-white/90 px-3 py-2.5 shadow-sm outline-none transition focus:ring-2"
            style={{
              borderColor: BRAND.soft,
              color: BRAND.text,
              boxShadow: "0 1px 1px rgba(0,0,0,.04)",
            }}
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {/* CTA */}
        <button
          type="submit"
          className="mt-6 w-full rounded-xl px-4 py-2.5 font-semibold shadow-sm transition hover:brightness-[.98] active:translate-y-[1px]"
          style={{ background: BRAND.main, color: "#fff" }}
        >
          Iniciar sesión
        </button>

        {/* Pie / ayuda opcional */}
        <div
          className="mt-4 text-center text-xs"
          style={{ color: `${BRAND.text}99` }}
        >
          ¿Olvidaste tu contraseña? Contactá a un administrador.
        </div>
      </form>
    </main>
  );
}
