"use client";
import PiecesOfStudent from "@/components/Pieces/PiecesOfStudent";
import { useAuth } from "@/context/AuthContext";
import { use } from "react";

export default function Page({ params }) {
  const { id } = use(params);
  const { user } = useAuth();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Piezas del alumno</h1>
      <PiecesOfStudent studentId={id} branchIdProp={user?.branch} />
    </div>
  );
}
