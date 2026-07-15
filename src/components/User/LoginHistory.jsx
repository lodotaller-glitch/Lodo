import React, { useState } from "react";
import {
  ClockIcon,
  TerminalIcon,
  GlobeIcon,
  MapPinIcon,
  browser,
  os,
  getDeviceIcon,
} from "../icons/LoginHistory";

// Paleta refinada con tonos tierra, marrón sofisticado y crema cálida
const BRAND = {
  main: "#967C64", // Marrón templado (mantiene la esencia del original de manera más pulida)
  mainHover: "#7E6650", // Marrón oscuro para estados activos / hover
  soft: "#EBE5D8", // Crema suave para bordes e interfaces ligeras
  softBg: "#FAF8F5", // Fondo ultra suave y limpio
  accent: "#D4AF37", // Toque dorado para destacar elementos especiales
  text: "#2C2520", // Texto principal en un tono chocolate súper oscuro y elegante
  textMuted: "#72655B", // Texto secundario
  success: "#4F6F52", // Verde oliva sutil para estados de éxito/activo
  danger: "#A35C5C", // Rojo arcilla sutil para acciones de borrado/alerta
};

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch (e) {
    return "Fecha desconocida";
  }
}

export function LoginHistory({ history = [] }) {
  // Estado local para rastrear qué detalles técnicos están abiertos y simular animación de colapso
  const [openDetails, setOpenDetails] = useState({});

  if (!history.length) {
    return (
      <div
        className="text-center p-12 rounded-2xl border"
        style={{ borderColor: BRAND.soft, backgroundColor: BRAND.softBg }}
      >
        <span className="text-3xl">📭</span>
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: BRAND.textMuted }}
        >
          No hay inicios de sesión registrados.
        </p>
      </div>
    );
  }

  // Ordenar dispositivos por fecha más reciente
  const sortedDevices = [...history].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const toggleDetails = (index) => {
    setOpenDetails((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <section
      className="rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 bg-white"
      style={{ borderColor: BRAND.soft }}
    >
      {/* Encabezado del Card */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(135deg, ${BRAND.softBg} 0%, #FFFFFF 100%)`,
        }}
      >
        <div>
          <h2
            className="text-lg font-bold tracking-tight"
            style={{ color: BRAND.text }}
          >
            Dispositivos desde los que accediste
          </h2>
        </div>

        <span
          className="self-start sm:self-auto rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide shadow-xs border"
          style={{
            background: BRAND.softBg,
            borderColor: BRAND.soft,
            color: BRAND.text,
          }}
        >
          {sortedDevices.length} dispositivo{sortedDevices.length !== 1 && "s"}{" "}
          registrado{sortedDevices.length !== 1 && "s"}
        </span>
      </div>

      {/* Listado de dispositivos */}
      <div className="divide-y" style={{ divideColor: BRAND.soft }}>
        {sortedDevices.map((login, index) => {
          const city = login.city ? decodeURIComponent(login.city) : null;
          const location = [city, login.region, login.country]
            .filter(Boolean)
            .join(", ");

          return (
            <div
              key={login.id || index}
              className="flex flex-col sm:flex-row gap-4 p-6 transition-all duration-200 hover:bg-[#FAF9F6]"
              style={{ borderColor: BRAND.soft }}
            >
              {/* Ícono de Dispositivo */}
              <div className="flex items-start">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 hover:scale-105"
                  style={{
                    background: `${BRAND.soft}40`,
                    borderColor: BRAND.soft,
                    color: BRAND.text,
                  }}
                >
                  {getDeviceIcon(login.userAgent)}
                </div>
              </div>

              {/* Información General */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="font-semibold text-base"
                    style={{ color: BRAND.text }}
                  >
                    {browser(login.userAgent)}
                  </h3>

                  {/* Etiqueta de S.O. */}
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium border"
                    style={{
                      background: BRAND.softBg,
                      borderColor: BRAND.soft,
                      color: BRAND.textMuted,
                    }}
                  >
                    {os(login.userAgent)}
                  </span>
                </div>

                {/* Detalles técnicos y metadata */}
                <div
                  className="mt-3 space-y-2 text-xs sm:text-sm"
                  style={{ color: BRAND.textMuted }}
                >
                  {location && (
                    <div className="flex items-center text-stone-600">
                      <span style={{ color: BRAND.main }}>
                        <MapPinIcon />
                      </span>
                      <span className="font-medium">{location}</span>
                    </div>
                  )}

                  <div className="flex items-center text-stone-500">
                    <span style={{ color: BRAND.main }}>
                      <GlobeIcon />
                    </span>
                    <span className="font-mono">{login.ip}</span>
                  </div>

                  <div className="flex items-center text-stone-500">
                    <span style={{ color: BRAND.main }}>
                      <ClockIcon />
                    </span>
                    <span>
                      Acceso:{" "}
                      <b className="font-medium text-stone-700">
                        {formatDate(login.createdAt)}
                      </b>
                    </span>
                  </div>
                </div>

                {/* Collapsible Técnico */}
                <div className="mt-4 pt-1">
                  <button
                    onClick={() => toggleDetails(index)}
                    className="flex items-center text-xs font-semibold hover:opacity-80 transition-colors duration-150 focus:outline-none"
                    style={{ color: BRAND.main }}
                  >
                    <TerminalIcon />
                    {openDetails[index]
                      ? "Ocultar agente de usuario"
                      : "Ver información técnica"}
                    <svg
                      className={`ml-1 w-3 h-3 transform transition-transform duration-200 ${openDetails[index] ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {openDetails[index] && (
                    <div
                      className="mt-3 rounded-xl p-3 text-[11px] font-mono leading-relaxed break-all border animate-fadeIn"
                      style={{
                        background: BRAND.softBg,
                        borderColor: BRAND.soft,
                        color: BRAND.textMuted,
                      }}
                    >
                      <div className="font-bold text-stone-600 mb-1">
                        User-Agent:
                      </div>
                      {login.userAgent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PreviewDashboard({ history = [] }) {
  return (
    <div className=" bg-[#F7F5F0] py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-start">
      <div className="max-w-4xl w-full space-y-6">
        {/* Banner de Bienvenida o Cabecera de la demostración */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-800 flex items-center gap-2">
              <span
                className="w-3 h-6 rounded-xs"
                style={{ backgroundColor: BRAND.main }}
              ></span>
              Panel de Seguridad
            </h1>
          </div>
        </div>

        {/* El Componente LoginHistory Refactorizado */}
        <LoginHistory history={history} />
      </div>
    </div>
  );
}
