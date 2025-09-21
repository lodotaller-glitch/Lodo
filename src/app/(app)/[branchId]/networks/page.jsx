"use client";
import NetworksList from "@/components/Networks/NetworksList";

export default function NetworksPage({ params }) {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <NetworksList />
    </main>
  );
}
