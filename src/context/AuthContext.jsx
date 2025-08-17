"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";

export const AuthContext = createContext(null);

function decodeJwtClaims(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null); // 👈 datos del usuario
  const [loading, setLoading] = useState(true);

  // Cada vez que cambia el token, actualizamos el header de axios
  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [accessToken]);

  // Refrescar sesión al montar
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function refresh() {
    try {
      // Importante: que tu axios tenga withCredentials:true para mandar la cookie refreshToken
      const { data } = await api.post("/auth/refresh-token");
      setAccessToken(data.accessToken || null);

      // Preferimos el user que envie el backend; si no viene, lo decodificamos del JWT
      if (data.user) {
        setUser(data.user);
      } else if (data.accessToken) {
        const claims = decodeJwtClaims(data.accessToken);
        if (claims) {
          // Acordate que en el token pusimos: { sub, id, name, email, role, state, capacity }
          setUser({
            id: claims.id || claims.sub,
            name: claims.name,
            email: claims.email,
            role: claims.role,
            state: claims.state,
            capacity: claims.capacity,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }

  function logout() {
    // Si tenés un endpoint para invalidar el refresh en server, podrías llamarlo acá.
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      accessToken,
      setAccessToken,
      user, // 👈 disponible en todo el app
      setUser,
      loading,
      refresh,
      logout,
    }),
    [accessToken, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
