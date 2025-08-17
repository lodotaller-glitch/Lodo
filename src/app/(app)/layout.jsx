import Header from "@/components/Ui/Header";

export default function AppLayout({ children }) {
  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </>
  );
}
