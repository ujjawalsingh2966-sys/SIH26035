"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, post, User } from "../../lib/api";

export default function ApplicationsPage() {
  const [user, setUser] = useState<User>();
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  async function load() {
    try {
      const [u, d] = await Promise.all([
        api<User>("/auth/me"),
        api("/verification/applications"),
      ]);
      setUser(u);
      setItems(d.applications);
      setAlerts(d.alerts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const value = (k: string) => String(f.get(k) || "");
    try {
      await post("/verification/applications", {
        businessName: value("businessName"),
        address: value("address"),
        instrument: {
          name: value("name"),
          model: value("model"),
          serialNumber: value("serialNumber"),
          accuracyClass: value("accuracyClass"),
          maxCapacity: value("maxCapacity"),
          minCapacity: value("minCapacity"),
          e: value("e"),
          d: value("d"),
          hasTare: f.get("hasTare") === "on",
          isWeighing: true,
          isManual: true,
          isElectronic: true,
          isSingleRange: true,
        },
      });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((a) =>
    `${a.id} ${a.businessName} ${a.instrument.serialNumber} ${a.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="w8-applications-list space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-teal-700 text-xs font-semibold tracking-widest mb-2">
            INSTRUMENT LIFECYCLE
          </p>
          <h1 className="text-3xl font-bold">Verification applications</h1>
          <p className="text-slate-500 mt-2">
            {user?.role === "Business"
              ? "Submit instruments and track every step of verification."
              : "Manage applications, inspections and certificate issuance."}
          </p>
        </div>
        {user?.role === "Business" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-teal-700 text-white px-5 py-3 rounded-lg"
          >
            {showForm ? "Close form" : "+ New application"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="bg-red-50 text-red-800 p-4 rounded">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Total applications", items.length],
          [
            "Awaiting allocation",
            items.filter((a) => a.status === "SUBMITTED").length,
          ],
          [
            "Scheduled / inspected",
            items.filter((a) => ["SCHEDULED", "INSPECTED"].includes(a.status))
              .length,
          ],
          ["Certified", items.filter((a) => a.status === "CERTIFIED").length],
        ].map(([label, count]) => (
          <div key={label} className="bg-white border rounded-xl p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-bold mt-2">{count}</p>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-semibold">Validity reminders</h2>
          <p className="text-sm text-amber-900">
            Certificates expired or due within 30 days. Reminders are shown
            here; email/SMS delivery is not enabled.
          </p>
          {alerts.map((a) => (
            <Link
              key={a.applicationId}
              href={`/applications/${a.applicationId}`}
              className="block mt-2 underline"
            >
              {a.instrumentName} — {a.expired ? "Expired" : "Due"}{" "}
              {new Date(a.validUntil).toLocaleDateString()}
            </Link>
          ))}
        </section>
      )}
      {showForm && (
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-xl font-semibold">
            New verification application
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Pilot scope: electronic, single-range, non-automatic weighing
            instruments, classes II–IIII. All measurements below are in grams.
          </p>
          <form onSubmit={submit} className="mt-5 grid md:grid-cols-2 gap-4">
            {[
              ["businessName", "Business name"],
              ["address", "Instrument location / address"],
              ["name", "Instrument name"],
              ["model", "Model"],
              ["serialNumber", "Serial number"],
            ].map(([name, label]) => (
              <label key={name} className="text-sm">
                {label}
                <input
                  name={name}
                  required
                  maxLength={name === "address" ? 1000 : 200}
                  className="block w-full border p-3 mt-1 rounded-lg"
                />
              </label>
            ))}
            <label className="text-sm">
              Accuracy class
              <select
                name="accuracyClass"
                defaultValue="III"
                className="block w-full border p-3 mt-1 rounded-lg"
              >
                <option>II</option>
                <option>III</option>
                <option>IIII</option>
              </select>
            </label>
            {[
              ["maxCapacity", "Maximum capacity"],
              ["minCapacity", "Minimum capacity"],
              ["e", "Verification interval (e)"],
              ["d", "Scale interval (d)"],
            ].map(([name, label]) => (
              <label key={name} className="text-sm">
                {label} (g)
                <input
                  name={name}
                  required
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]+)?"
                  className="block w-full border p-3 mt-1 rounded-lg"
                />
              </label>
            ))}
            <label className="text-sm flex gap-2 items-center">
              <input name="hasTare" type="checkbox" /> Has a tare function
            </label>
            <label className="text-sm flex gap-2 items-center">
              <input required type="checkbox" /> I confirm this instrument fits
              the pilot scope.
            </label>
            <button
              disabled={busy}
              className="bg-teal-700 text-white px-5 py-3 rounded-lg md:col-span-2 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </section>
      )}
      <section className="bg-white border rounded-xl overflow-hidden">
        <div className="p-5 border-b">
          <label className="text-sm text-slate-600">
            Search applications
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business, serial number, status or application ID"
              className="block border rounded-lg p-3 w-full mt-2"
            />
          </label>
        </div>
        {loading ? (
          <p role="status" className="p-8">
            Loading applications…
          </p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-500">
            {query ? "No matching applications." : "No applications yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Instrument", "Business", "Status", "Submitted", ""].map(
                    (h, i) => (
                      <th key={i} className="px-5 py-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-5">
                      <span className="font-semibold">{a.instrument.name}</span>
                      <br />
                      <span className="text-slate-500">
                        {a.instrument.serialNumber}
                      </span>
                    </td>
                    <td className="p-5">{a.businessName}</td>
                    <td className="p-5">
                      <span className="text-xs rounded-full bg-teal-50 text-teal-800 px-3 py-1">
                        {a.status}
                      </span>
                    </td>
                    <td className="p-5">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-5">
                      <Link
                        className="text-teal-700 font-semibold"
                        href={`/applications/${a.id}`}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
