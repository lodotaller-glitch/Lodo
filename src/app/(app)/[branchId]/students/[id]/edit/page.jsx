import UserEditor from "@/components/User/UserEditor";
import EnrollmentManagerById from "@/components/User/Enrollment/EnrollmentManagerById";

export default async function UserEditPage({ params }) {
  const { id, branchId } = (await params) || {};

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <UserEditor userId={id} title="Datos del estudiante" />
      <EnrollmentManagerById studentId={id} />
    </main>
  );
}
