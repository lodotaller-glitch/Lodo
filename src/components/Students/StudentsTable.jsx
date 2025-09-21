"use client";
export default function StudentsTable({ items, loading, onEdit }) {
  return (
    <div className="overflow-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-[#DDD7C9]">
          <tr className="text-left">
            <th className="px-4 py-2">Nombre</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Estado</th>
            <th className="px-4 py-2">Creado</th>
            <th className="px-4 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td className="px-4 py-3" colSpan={5}>
                Cargando…
              </td>
            </tr>
          )}
          {!loading && items?.length === 0 && (
            <tr>
              <td className="px-4 py-3" colSpan={5}>
                Sin resultados
              </td>
            </tr>
          )}
          {!loading &&
            items?.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      u.state
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {u.state ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => onEdit(u._id)}
                    className="px-3 py-1.5 rounded-lg bg-[#A08775] text-white"
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
