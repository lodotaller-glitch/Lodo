import ListMyPieces from "@/components/Pieces/ListMyPieces";

export default function Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Mis piezas</h1>
        <a
          href="/student/pieces/new"
          className="px-3 py-2 rounded-xl bg-black/80 text-white"
        >
          Nueva pieza
        </a>
      </div>
      <ListMyPieces />
    </div>
  );
}
