"use client"
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

const MAX = 5;
const MAX_MB = 8; // límite de peso por archivo (MB)

async function uploadToCloudinary(file) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", preset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: fd }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Fallo al subir imagen");
  return json.secure_url;
}

export default function NewPiecePage() {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]); // File[]
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user } = useAuth(); // {branch}

  const canAddMore = files.length < MAX;
  const remaining = Math.max(0, MAX - files.length);

  function onPickFiles(e) {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;

    const asImages = chosen.filter((f) => f.type.startsWith("image/"));
    const tooBig = asImages.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`Cada archivo debe pesar ≤ ${MAX_MB} MB`);
      return;
    }

    setFiles((prev) => [...prev, ...asImages.slice(0, remaining)]);
    e.currentTarget.value = ""; // reset input
  }
  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  const previews = useMemo(
    () => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files]
  );

  // Limpia los object URLs al cambiar/descargar
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews.length]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Título requerido");
      return;
    }
    if (files.length === 0) {
      setError("Subí al menos una imagen");
      return;
    }

    setUploading(true);
    try {
      // 1) Subir imágenes a Cloudinary y obtener URLs seguras
      const urls = await Promise.all(files.map(uploadToCloudinary));

      // 2) Guardar pieza con los links devueltos
      const res = await fetch(`/api/${user?.branch}/pieces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, images: urls }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo crear");

      router.push("/student/pieces");
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {/* Encabezado */}
      <div
        className="mb-4 rounded-2xl border"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: BRAND.text }}
          >
            Nueva pieza
          </h1>
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              backgroundColor: BRAND.soft,
              color: BRAND.text,
              border: `1px solid ${BRAND.main}55`,
            }}
          >
            Máx. {MAX} imágenes
          </span>
        </div>
      </div>

      {/* Card principal */}
      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border p-4 shadow-sm sm:p-6"
        style={{ borderColor: BRAND.soft }}
      >
        {/* Campo Título */}
        <div>
          <label
            className="mb-1 block text-sm font-medium"
            style={{ color: `${BRAND.text}CC` }}
          >
            Título
          </label>
          <input
            className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Área de subida */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Imágenes — máx {MAX}
            </label>

            {/* Botón/label estilizado para el input file */}
            <label
              htmlFor="file-input"
              className="cursor-pointer select-none rounded-xl border border-dashed px-3 py-1.5 text-sm shadow-sm transition hover:shadow"
              style={{
                borderColor: `${BRAND.main}66`,
                backgroundColor: `${BRAND.soft}66`,
                color: BRAND.text,
                opacity: canAddMore ? 1 : 0.6,
              }}
            >
              {canAddMore
                ? `+ Añadir (${remaining} disp.)`
                : "Límite alcanzado"}
            </label>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              disabled={!canAddMore}
              className="sr-only"
            />
          </div>

          {/* Previews */}
          {previews.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {previews.map((p, i) => (
                <li key={i} className="group relative">
                  <div
                    className="aspect-square w-full overflow-hidden rounded-xl border"
                    style={{ borderColor: BRAND.soft }}
                  >
                    <img
                      src={p.url}
                      alt={p.name}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 rounded-full px-2 py-1 text-xs shadow"
                    style={{
                      backgroundColor: `${BRAND.text}CC`,
                      color: "#fff",
                      border: `1px solid ${BRAND.soft}`,
                    }}
                    aria-label="Quitar imagen"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
           null
          )}

          <p className="text-xs opacity-70" style={{ color: BRAND.text }}>
            Formatos: JPG/PNG/WebP. Máx {MAX_MB}MB c/u.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p
            className="rounded-xl border px-3 py-2 text-sm"
            style={{
              color: "#991B1B",
              backgroundColor: "#FEF2F2",
              borderColor: "#FECACA",
            }}
          >
            {error}
          </p>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: BRAND.main, color: "#fff" }}
          >
            {uploading ? "Subiendo…" : "Crear"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              setError("");
            }}
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm transition"
            style={{
              borderColor: BRAND.main,
              backgroundColor: `${BRAND.soft}55`,
              color: BRAND.text,
            }}
          >
            Limpiar selección
          </button>
        </div>
      </form>
    </div>
  );
}
