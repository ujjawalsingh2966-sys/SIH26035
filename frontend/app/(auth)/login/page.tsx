"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const input = {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      };
      if (register) {
        await post("/auth/register", input);
        setRegister(false);
        setMessage(
          "Business account created. Sign in to submit an application.",
        );
      } else {
        const data = await post("/auth/login", input);
        localStorage.setItem("nawi_token", data.token);
        router.replace("/applications");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl">
        <p className="text-teal-700 font-semibold tracking-widest text-sm">
          W8LAB
        </p>
        <h1 className="text-3xl font-bold mt-3 text-slate-900">
          {register ? "Register your business" : "Welcome back"}
        </h1>
        <p className="text-slate-500 mt-2 mb-6">
          Track instrument verification from application to certificate.
        </p>
        {error && (
          <p role="alert" className="p-3 bg-red-50 text-red-800 rounded mb-4">
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="p-3 bg-teal-50 text-teal-800 rounded mb-4"
          >
            {message}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          {register && (
            <label className="block">
              Your name
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                className="block w-full border rounded-lg p-3 mt-1"
              />
            </label>
          )}
          <label className="block">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="block w-full border rounded-lg p-3 mt-1"
            />
          </label>
          <label className="block">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={register ? 12 : 1}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              className="block w-full border rounded-lg p-3 mt-1"
            />
          </label>
          {register && (
            <p className="text-xs text-slate-500">
              Use at least 12 characters. Officer and staff accounts are created
              by an administrator.
            </p>
          )}
          <button
            disabled={busy}
            className="w-full bg-teal-700 text-white rounded-lg p-3 font-semibold disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : register
                ? "Create business account"
                : "Sign in"}
          </button>
        </form>
        <button
          onClick={() => {
            setRegister(!register);
            setError("");
            setMessage("");
          }}
          className="text-teal-700 mt-5 text-sm underline"
        >
          {register
            ? "Already registered? Sign in"
            : "New business? Create an account"}
        </button>
        <p className="text-xs text-slate-500 mt-6 border-t pt-4">
          SIH prototype • Limited electronic NAWI verification profile
        </p>
      </section>
    </main>
  );
}
