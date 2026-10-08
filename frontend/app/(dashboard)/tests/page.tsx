"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, User } from "../../lib/api";
export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [user, setUser] = useState<User>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api<any[]>("/test-cases"), api<User>("/auth/me")])
      .then(([rows, u]) => {
        setTests(rows);
        setUser(u);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="space-y-6">
      <div className="flex justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Laboratory test queue</h1>
          <p className="text-slate-500 mt-2">
            Existing laboratory records. New business verification requests
            appear in Applications.
          </p>
        </div>
        {user?.role === "Technician" && (
          <Link href="/instruments/new" className="text-teal-700 underline">
            Intake an instrument
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading test cases…</p>
      ) : tests.length ? (
        <ul className="bg-white border rounded-xl divide-y">
          {tests.map((t) => (
            <li key={t.id} className="p-5 flex flex-wrap justify-between gap-4">
              <div>
                <p className="font-semibold">{t.id}</p>
                <p className="text-sm text-slate-500">{t.status}</p>
              </div>
              <Link
                className="text-teal-700"
                href={`/test-cases/${t.id}/workspace`}
              >
                Open workspace →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bg-white border rounded-xl p-8">
          No laboratory test cases to show.
        </p>
      )}
    </section>
  );
}
