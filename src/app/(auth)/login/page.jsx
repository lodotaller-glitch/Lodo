// app/login/page.jsx
"use client";
import { useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setAccessToken } = useAuth();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { email, password });
      setAccessToken(res.data.accessToken);
      router.push("/dashboard");
    } catch {
      alert("Credenciales inválidas");
    }
  }

  return (
    <form onSubmit={onSubmit} className=" flex flex-col gap-4 p-4 justify-center items-center">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <div>
        <h2>email</h2>
        <input
          className="border p-2 rounded"
          type="email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <h2>contraseña</h2>
        <input
          className="border p-2 rounded"
          type="password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit">Iniciar sesión</button>
    </form>
  );
}
