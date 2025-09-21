"use client"
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

const STATUSES = [
  "Lista",
  "En preparacion",
  "En el horno",
  "Destruida",
  "Sin terminar",
];

const MAX = 5;
const MAX_MB = 8;

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

export default function EditPiecePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id;
  const id = params?.pieceId;
  const branchId = params?.branchId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");

  const [urls, setUrls] = useState([]); // links ya guardados
  const [files, setFiles] = useState([]); // nuevos archivos a subir

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/${branchId}/pieces/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "No encontrada");
        if (!alive) return;
        setTitle(json.piece.title || "");
        setStatus(json.piece.status || "");
        setUrls(Array.isArray(json.piece.images) ? json.piece.images : []);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const canAddMore = urls.length + files.length < MAX;
  const previews = useMemo(
    () => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files]
  );
  function onPickFiles(e) {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    const images = chosen.filter((f) => f.type.startsWith("image/"));
    const tooBig = images.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`Cada archivo ≤ ${MAX_MB}MB`);
      return;
    }
    const remaining = Math.max(0, MAX - (urls.length + files.length));
    setFiles((prev) => [...prev, ...images.slice(0, remaining)]);
    e.currentTarget.value = "";
  }

  function removeExistingUrl(i) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeNewFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Título requerido");
      return;
    }
    if (urls.length + files.length === 0) {
      setError("Debe haber al menos una imagen");
      return;
    }

    setSaving(true);
    try {
      const newUrls = files.length
        ? await Promise.all(files.map(uploadToCloudinary))
        : [];
      const imagesFinal = [...urls, ...newUrls];
      const res = await fetch(`/api/${branchId}/pieces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, images: imagesFinal, status }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo guardar");
      router.push(`/${branchId}/students/${studentId}/pieces`);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }
  async function onDelete() {
    if (!confirm("¿Eliminar definitivamente esta pieza?")) return;
    try {
      const res = await fetch(`/api/${branchId}/pieces/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo eliminar");
      router.push(`/${branchId}/students/${studentId}/pieces`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded-xl bg-black/10" />
          <div className="h-40 w-full rounded-2xl bg-black/5" />
          <div className="h-10 w-1/2 rounded-xl bg-black/10" />
        </div>
      </div>
    );

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
            Editar pieza
          </h1>
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              backgroundColor: `${BRAND.soft}`,
              color: BRAND.text,
              border: `1px solid ${BRAND.main}55`,
            }}
          >
            Máx. {MAX} imágenes
          </span>
        </div>
      </div>

      {/* Card */}
      <form
        onSubmit={onSave}
        className="space-y-6 rounded-2xl border p-4 shadow-sm sm:p-6"
        style={{ borderColor: BRAND.soft }}
      >
        {/* Título y estado */}
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <label
              className="mb-1 block text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Título
            </label>
            <input
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{
                borderColor: `${BRAND.soft}`,
                color: BRAND.text,
                boxShadow: `0 0 0 1px transparent`,
              }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Estado
            </label>
            <select
              className="w-full appearance-none rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Imágenes guardadas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              className="text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Imágenes guardadas ({urls.length})
            </label>
          </div>

          {urls.length === 0 ? (
            <p className="text-sm opacity-75" style={{ color: BRAND.text }}>
              No hay imágenes guardadas.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {urls.map((u, i) => (
                <li key={i} className="group relative">
                  <div
                    className="aspect-square w-full overflow-hidden rounded-xl border"
                    style={{ borderColor: BRAND.soft }}
                  >
                    <img
                      src={u}
                      alt="img"
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExistingUrl(i)}
                    className="absolute right-1 top-1 rounded-full px-2 py-1 text-xs shadow"
                    style={{
                      backgroundColor: `${BRAND.text}CC`,
                      color: "#fff",
                      border: `1px solid ${BRAND.soft}`,
                    }}
                    aria-label="Quitar imagen guardada"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Nuevas imágenes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Agregar imágenes nuevas (máx {Math.max(0, MAX - urls.length)})
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
              {canAddMore ? "+ Añadir" : "Límite alcanzado"}
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

          {previews.length > 0 && (
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
                    onClick={() => removeNewFile(i)}
                    className="absolute right-1 top-1 rounded-full px-2 py-1 text-xs shadow"
                    style={{
                      backgroundColor: `${BRAND.text}CC`,
                      color: "#fff",
                      border: `1px solid ${BRAND.soft}`,
                    }}
                    aria-label="Quitar imagen a subir"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs opacity-70" style={{ color: BRAND.text }}>
            Se permiten hasta {MAX} imágenes en total (guardadas + nuevas). Cada
            archivo ≤ {MAX_MB}MB.
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
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: BRAND.main,
              color: "#fff",
              boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
            }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-medium transition"
            style={{
              borderColor: BRAND.main,
              color: BRAND.text,
              backgroundColor: `${BRAND.soft}55`,
            }}
          >
            Eliminar pieza
          </button>
        </div>
      </form>
    </div>
  );
}
