"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBranch } from "@/functions/request/branches";

function normalizeCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export default function BranchCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touchedCode, setTouchedCode] = useState(false);

  // Auto-generate code from name until user edits code manually
  useEffect(() => {
    if (!touchedCode) setCode(normalizeCode(name));
  }, [name, touchedCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const finalName = name.trim();
      const finalCode = normalizeCode(code || name);
      if (!finalName) throw new Error("Name is required");
      if (!finalCode) throw new Error("Code is required");

      const payload = {
        name: finalName,
        code: finalCode,
        address: address.trim(),
        phone: phone.trim(),
      };

      const res = await createBranch(payload);
      const branchId = res?.branchId || res?.id || res?._id || null;
      if (branchId) router.push(`/${branchId}`);
      else router.push("/branches");
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to create branch";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Create Branch</h1>
        <Link href="/branches" className="ml-auto text-sm text-blue-600">
          Volver
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white rounded-2xl shadow p-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Lodo Taller"
            required
          />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium">
              Codigo<span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setTouchedCode(true);
                setCode(normalizeCode(name));
              }}
              className="ml-auto text-xs px-2 py-1 border rounded"
            >
              Usar Nombre
            </button>
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setTouchedCode(true);
              setCode(normalizeCode(e.target.value));
            }}
            className="w-full border rounded-lg px-3 py-2 mt-1 tracking-wider uppercase"
            placeholder="LODO"
            maxLength={24}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Solo letras y números en mayúsculas.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Direccion</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Telefono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Opcional"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-white disabled:opacity-60"
            style={{ background: "#111" }}
          >
            {saving ? "Creando…" : "Crear Sucursal"}
          </button>
          <Link href="/branches" className="px-4 py-2 rounded-xl border">
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
