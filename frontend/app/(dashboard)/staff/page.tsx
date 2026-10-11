"use client";
import { useEffect, useState } from "react";
import { api, post, User } from "../../lib/api";
export default function StaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    api<User>("/auth/me")
      .then((u) => {
        if (u.role !== "Administrator")
          throw new Error("This page is for administrators.");
        setAllowed(true);
        return api<User[]>("/auth/staff");
      })
      .then(setStaff)
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await post("/auth/staff", Object.fromEntries(f));
      setStaff(await api<User[]>("/auth/staff"));
      form.reset();
      setMessage("Staff account created.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Staff accounts</h1>
      {error && (
        <p role="alert" className="p-4 bg-red-50 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="p-4 bg-teal-50 text-teal-800">
          {message}
        </p>
      )}
      {allowed && (
        <>
          <form
            onSubmit={submit}
            className="bg-white border rounded-xl p-6 grid md:grid-cols-2 gap-4"
          >
            {[
              ["name", "Name", "text"],
              ["email", "Email", "email"],
              ["password", "Initial password", "password"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input
                  required
                  name={name}
                  type={type}
                  autoComplete={type === "password" ? "new-password" : "off"}
                  minLength={type === "password" ? 12 : 2}
                  maxLength={type === "password" ? 128 : 120}
                  className="block border rounded p-3 mt-1 w-full"
                />
              </label>
            ))}
            <label>
              Role
              <select
                name="role"
                className="block border rounded p-3 mt-1 w-full"
              >
                {["LMO", "GATC", "Technician", "Reviewer", "Administrator"].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  ),
                )}
              </select>
            </label>
            <p className="text-sm text-slate-500 md:col-span-2">
              Use a unique password of at least 12 characters and share it with
              the staff member through a secure channel.
            </p>
            <button
              disabled={busy}
              className="rounded bg-teal-700 text-white p-3 disabled:opacity-50"
            >
              Create staff account
            </button>
          </form>
          <ul className="bg-white border rounded-xl divide-y">
            {staff.map((s) => (
              <li
                key={s.id}
                className="p-5 flex justify-between flex-wrap gap-3"
              >
                <div className="break-all">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.email}</p>
                </div>
                <span className="text-sm text-teal-800">{s.role}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
