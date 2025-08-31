"use client";
import RoleCalendar from "@/components/Calendar/RoleCalendar";

export default function ProfessorHomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Mis Clases</h1>
      <RoleCalendar role="professor" />
    </main>
  );
}
