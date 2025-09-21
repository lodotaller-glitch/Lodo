import PiecesOfStudent from "@/components/Pieces/PiecesOfStudent";
import { use } from "react";

export default function Page({ params }) {
  const { id } = use(params);
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Piezas del alumno</h1>
      <PiecesOfStudent studentId={id} />
    </div>
  );
}
