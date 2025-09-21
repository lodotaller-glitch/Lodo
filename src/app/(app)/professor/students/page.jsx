"use client";
import StudentsList from "@/components/Students/StudentsList";

export default function StudentsPage({params}) {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <StudentsList professor={true} />
    </main>
  );
}
