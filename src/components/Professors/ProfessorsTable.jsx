"use client";
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function ProfessorsTable({ items, loading, onEdit }) {
  return (
    <div className="overflow-auto border rounded-xl" style={{ borderColor: BRAND.soft }}>
      <table className="min-w-full text-sm">
        <thead style={{ background: BRAND.soft }}>
          <tr className="text-left" style={{ color: BRAND.text }}>
            <th className="px-4 py-2">Nombre</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Capacidad</th>
            <th className="px-4 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td className="px-4 py-3" colSpan={4}>
                Cargando…
              </td>
            </tr>
          )}

          {!loading && items?.length === 0 && (
            <tr>
              <td className="px-4 py-3" colSpan={4}>
                Sin resultados
              </td>
            </tr>
          )}

          {!loading && items?.map((p) => (
            <tr key={p._id} className="border-t" style={{ borderColor: BRAND.soft }}>
              <td className="px-4 py-2 font-medium" style={{ color: BRAND.text }}>{p.name}</td>
              <td className="px-4 py-2">{p.email}</td>
              <td className="px-4 py-2">
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    background: "#F3F4F6",
                    color: BRAND.text,
                    border: `1px solid ${BRAND.soft}`,
                  }}
                >
                  {p.capacity ?? 10}
                </span>
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => onEdit(p._id)}
                  className="px-3 py-1.5 rounded-lg text-white"
                  style={{ background: BRAND.main }}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
