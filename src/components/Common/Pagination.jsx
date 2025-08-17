"use client";
export default function Pagination({ page, perPage, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (perPage || 10)));
  if (totalPages <= 1) return null;

  function go(n) {
    if (n < 1 || n > totalPages) return;
    onPageChange(n);
  }

  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++)
    pages.push(i);

  return (
    <div className="flex items-center justify-between pt-3">
      <div className="text-sm text-gray-600">
        Página {page} de {totalPages} — {total} resultados
      </div>
      <div className="flex items-center gap-1">
        <button
          className="px-3 py-1.5 rounded-lg border"
          onClick={() => go(page - 1)}
        >
          Anterior
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            className={`px-3 py-1.5 rounded-lg border ${
              p === page ? "bg-white" : ""
            }`}
          >
            {p}
          </button>
        ))}
        <button
          className="px-3 py-1.5 rounded-lg border"
          onClick={() => go(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
