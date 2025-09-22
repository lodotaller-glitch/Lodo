"use client";

import UserEditor from "@/components/User/UserEditor";
import EnrollmentManagerById from "@/components/User/Enrollment/EnrollmentManagerById";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";

export default function UserEditPage({ params }) {
  const { id } = useParams() || {};
  const { user } = useAuth();
  const branchId = user?.branch; // puede venir undefined al primer render

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <UserEditor
        userId={id}
        branchIdProp={branchId}
        title="Datos del estudiante"
        professor={true}
      />

      {id && <EnrollmentManagerById studentId={id} branchId={branchId} />}
    </main>
  );
}
