"use client";
import Link from "next/link";

export default function ChangeClassButton({
  studentId,
  label = "Cambiar clase",
}) {
  const href = `/students/${studentId}/cambiar-horario`;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border"
      style={{
        borderColor: "#A08775",
        color: "#1F1C19",
        background: "#DDD7C9",
      }}
    >
      {label}
    </Link>
  );
}
