"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBranches } from "@/functions/request/branches";

export default function BranchListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { branches } = await fetchBranches();
        setItems(branches || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-semibold">Branches</h1>
        <Link
          href="/branches/new"
          className="ml-auto px-3 py-2 rounded bg-black text-white"
        >
          New Branch
        </Link>
      </div>
      {loading ? (
        "Loading…"
      ) : (
        <ul className="divide-y">
          {items.map((b) => (
            <li key={b._id} className="py-3 flex items-center">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-sm text-gray-500">{b.code}</div>
              </div>
              <Link
                href={`/branches/${b._id}`}
                className="ml-auto text-blue-600"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
