import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Ui/Header";

export const metadata = { title: "Academia", description: "Turnos y clases" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        className="min-h-screen text-[#1F1C19]"
        style={{ background: "#DDD7C9" }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
