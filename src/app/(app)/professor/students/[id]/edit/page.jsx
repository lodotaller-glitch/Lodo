"use client";

import UserEditor from "@/components/User/UserEditor";
import EnrollmentManagerById from "@/components/User/Enrollment/EnrollmentManagerById";
import { useAuth } from "@/context/AuthContext";

export default function ProfessorEditStudentPage({ params }) {
  const { id } = params || {};
  const { user } = useAuth();
  const branchId = user?.branch;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <UserEditor userId={id} branchId={branchId} title="Datos del estudiante" />
      <EnrollmentManagerById studentId={id} branchId={branchId} />
    </main>
  );
}