import UserEditor from "@/components/User/UserEditor";

export default async function NetworkUserEditPage({ params }) {
  const { id } = (await params) || {};

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <UserEditor userId={id} title="Datos del usuario de redes" role="networks" />
    </main>
  );
}