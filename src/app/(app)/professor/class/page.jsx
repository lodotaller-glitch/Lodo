"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ProfessorClassPage() {
  const params = useSearchParams();
  const start = params.get("start");
  const slot = params.get("slot");

  const [students, setStudents] = useState([
    { id: "1", name: "Alumno 1", present: false },
    { id: "2", name: "Alumno 2", present: false },
  ]);

  function toggle(id) {
    setStudents((arr) =>
      arr.map((s) => (s.id === id ? { ...s, present: !s.present } : s))
    );
  }

  function addStudent() {
    const name = prompt("Nombre del estudiante");
    if (name)
      setStudents((arr) => [...arr, { id: String(Date.now()), name, present: false }]);
  }

  function removeStudent(id) {
    setStudents((arr) => arr.filter((s) => s.id !== id));
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Clase</h1>
        {start && (
          <p className="text-sm text-gray-600">
            {new Date(start).toLocaleString()}
          </p>
        )}
      </header>

      <section className="bg-white p-4 rounded-2xl shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-medium">Asistencia</h2>
          <button
            // onClick={addStudent}
            className="px-3 py-1.5 rounded-xl text-white"
            style={{ background: "#A08775" }}
          >
            Agregar alumno
          </button>
        </div>
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.present}
                  onChange={() => toggle(s.id)}
                />
                {s.name}
              </label>
              <button
                // onClick={() => removeStudent(s.id)}
                className="text-sm text-red-600"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-4 rounded-2xl shadow space-y-3">
        <h2 className="font-medium">QR de asistencia</h2>
        <p className="text-sm text-gray-600">
          Comparte este código con los estudiantes para que marquen su
          asistencia.
        </p>
        <div className="p-4 border rounded-xl text-center select-all">
          {/* {start && slot ? `${start}|${slot}` : "sin datos"} */}
        </div>
      </section>
    </main>
  );
}