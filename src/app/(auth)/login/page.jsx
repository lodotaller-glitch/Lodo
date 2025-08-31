// app/login/page.jsx
"use client";
import { useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setAccessToken } = useAuth();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAccessToken(data.accessToken);
      const { user } = data;
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
        case "network":
          router.push("/network");
          break;
        default:
          break;
      }
    } catch {
      alert("Credenciales inválidas");
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: BRAND.soft }}
    >
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow p-8 flex flex-col gap-6 w-full max-w-md"
      >
        <h1
          className="text-2xl font-bold mb-2 text-center"
          style={{ color: BRAND.main }}
        >
          Iniciar sesión
        </h1>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: BRAND.text }}
          >
            Email
          </label>
          <input
            className="border rounded-lg px-3 py-2 w-full"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={{ borderColor: BRAND.soft }}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: BRAND.text }}
          >
            Contraseña
          </label>
          <input
            className="border rounded-lg px-3 py-2 w-full"
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            style={{ borderColor: BRAND.soft }}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl text-white font-semibold"
          style={{ background: BRAND.main }}
        >
          Iniciar sesión
        </button>
      </form>
    </main>
  );
}
