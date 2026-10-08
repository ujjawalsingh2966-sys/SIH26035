"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, User } from "../lib/api";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const expired = () => router.replace("/login");
    window.addEventListener("session-expired", expired);
    if (!localStorage.getItem("nawi_token")) expired();
    else
      api<User>("/auth/me")
        .then(setUser)
        .catch((e) => setError(e.message));
    return () => window.removeEventListener("session-expired", expired);
  }, [router]);
  function logout() {
    localStorage.removeItem("nawi_token");
    router.replace("/login");
  }
  if (!user)
    return (
      <main className="p-8">
        <p role="status">{error || "Loading your workspace…"}</p>
        {error && (
          <button onClick={logout} className="underline">
            Return to sign in
          </button>
        )}
      </main>
    );
  const legacy = ["Technician", "Reviewer", "Administrator"].includes(
    user.role,
  );
  const links = [
    { href: "/applications", label: "Applications" },
    ...(user.role === "Administrator"
      ? [{ href: "/staff", label: "Staff accounts" }]
      : []),
    ...(legacy
      ? [
          { href: "/dashboard", label: "Laboratory" },
          { href: "/tests", label: "Test queue" },
        ]
      : []),
  ];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/applications" className="font-bold text-xl tracking-wide">
          W8Lab{" "}
          <span className="font-normal text-xs text-teal-300 ml-2">
            VERIFICATION
          </span>
        </Link>
        <div className="text-sm flex items-center gap-4">
          <span>
            {user.name} <span className="text-slate-400">· {user.role}</span>
          </span>
          <button
            onClick={logout}
            className="border border-slate-600 rounded px-3 py-1"
          >
            Sign out
          </button>
        </div>
      </header>
      <nav
        aria-label="Main navigation"
        className="bg-white border-b flex gap-2 px-4 md:px-8 overflow-x-auto print:hidden"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap px-4 py-4 text-sm border-b-2 ${pathname.startsWith(l.href) ? "border-teal-700 text-teal-800 font-semibold" : "border-transparent text-slate-500"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <main className="max-w-7xl mx-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
