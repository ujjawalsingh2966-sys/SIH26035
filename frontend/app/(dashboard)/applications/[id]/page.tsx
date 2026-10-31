"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, post, User } from "../../../lib/api";
export default function ApplicationPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const base = `/verification/applications/${params.id}`;
  const [a, setA] = useState<any>();
  const [user, setUser] = useState<User>();
  const [staff, setStaff] = useState<User[]>([]);
  const [certificate, setCertificate] = useState<any>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [observations, setObservations] = useState([
    {
      testType: "WEIGHING",
      load: "",
      indication: "",
      additionalWeights: "",
      zeroError: "0",
    },
    {
      testType: "ECCENTRICITY",
      load: "",
      indication: "",
      additionalWeights: "",
      zeroError: "0",
    },
  ]);
  async function load() {
    const [application, current] = await Promise.all([
      api(base),
      api<User>("/auth/me"),
    ]);
    setA(application);
    setUser(current);
    if (current.role === "Administrator")
      setStaff(
        (await api<User[]>("/auth/staff")).filter((u) =>
          ["LMO", "GATC"].includes(u.role),
        ),
      );
    if (application.certificate)
      setCertificate(await api(`${base}/certificate`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [params.id]);
  async function action(path: string, body: unknown) {
    setError("");
    setBusy(true);
    try {
      await post(`${base}/${path}`, body);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function renew() {
    setError("");
    setBusy(true);
    try {
      const next = await post("/verification/applications", {
        businessName: a.businessName,
        address: a.address,
        instrument: a.instrument,
        previousApplicationId: a.id,
      });
      router.push(`/applications/${next.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const field = "block w-full border rounded-lg p-3 mt-1";
  const button =
    "bg-teal-700 text-white rounded-lg px-5 py-3 disabled:opacity-50";
  if (!a)
    return (
      <div>
        <p role={error ? "alert" : "status"}>
          {error || "Loading application…"}
        </p>
        <Link href="/applications" className="underline">
          Back to applications
        </Link>
      </div>
    );
  const officer =
    ["LMO", "GATC"].includes(user?.role || "") && a.officerId === user?.id;
  return (
    <div className="w8-application-detail space-y-6">
      <Link href="/applications" className="text-teal-700 print:hidden">
        ← Applications
      </Link>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 break-all">{a.id}</p>
          <h1 className="text-3xl font-bold mt-2">{a.instrument.name}</h1>
          <p className="text-slate-500 mt-2">
            {a.businessName} ·{" "}
            {a.type === "INITIAL" ? "Initial verification" : "Re-verification"}
          </p>
        </div>
        <span className="self-start px-4 py-2 rounded-full bg-teal-100 text-teal-900 text-sm">
          {a.status}
        </span>
      </div>
      {error && (
        <p role="alert" className="bg-red-50 text-red-800 rounded p-4">
          {error}
        </p>
      )}
      <section className="bg-white border rounded-xl p-6 grid md:grid-cols-2 gap-5">
        <div>
          <h2 className="font-semibold">Instrument details</h2>
          <p className="mt-2">
            {a.instrument.model} · Serial {a.instrument.serialNumber}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Class {a.instrument.accuracyClass} · Max {a.instrument.maxCapacity}{" "}
            g · Min {a.instrument.minCapacity} g<br />
            e: {a.instrument.e} g · d: {a.instrument.d} g
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Verification location</h2>
          <p className="mt-2">{a.address}</p>
          {a.scheduledAt && (
            <p className="text-teal-800 mt-2">
              Appointment: {new Date(a.scheduledAt).toLocaleString()}
            </p>
          )}
        </div>
      </section>
      {user?.role === "Administrator" &&
        ["SUBMITTED", "SCHEDULED"].includes(a.status) && (
          <section className="bg-white border rounded-xl p-6">
            <h2 className="text-xl font-semibold">Assign and schedule</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                action("assign", {
                  officerId: f.get("officerId"),
                  scheduledAt: new Date(
                    String(f.get("scheduledAt")),
                  ).toISOString(),
                });
              }}
              className="grid md:grid-cols-2 gap-4 mt-4"
            >
              <label>
                Officer / test centre
                <select
                  name="officerId"
                  required
                  className={field}
                  defaultValue={a.officerId || ""}
                >
                  <option value="">Choose LMO or GATC</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Appointment (your local time)
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  className={field}
                />
              </label>
              <button disabled={busy || !staff.length} className={button}>
                Save appointment
              </button>
              {!staff.length && (
                <p>
                  Create an LMO or GATC in{" "}
                  <Link className="underline" href="/staff">
                    Staff accounts
                  </Link>{" "}
                  first.
                </p>
              )}
            </form>
          </section>
        )}
      {officer && a.status === "SCHEDULED" && (
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-xl font-semibold">Record inspection</h2>
          <p className="text-sm text-slate-500 mt-2">
            Enter actual field observations in grams. This prototype evaluates
            weighing, eccentricity and tare using the existing limited
            calculation profile. It does not establish full regulatory
            compliance. Include tare observations when the instrument has tare.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action("inspect", { notes: f.get("notes"), observations });
            }}
            className="mt-5 space-y-4"
          >
            {observations.map((o, index) => (
              <fieldset key={index} className="border rounded-lg p-4">
                <legend className="text-sm px-2">
                  Observation {index + 1}
                </legend>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <label className="text-sm">
                    Test
                    <select
                      className={field}
                      value={o.testType}
                      onChange={(e) =>
                        setObservations((rows) =>
                          rows.map((r, i) =>
                            i === index
                              ? { ...r, testType: e.target.value }
                              : r,
                          ),
                        )
                      }
                    >
                      {[
                        "WEIGHING",
                        "ECCENTRICITY",
                        ...(a.instrument.hasTare ? ["TARE"] : []),
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      "load",
                      "indication",
                      "additionalWeights",
                      "zeroError",
                    ] as const
                  ).map((key) => (
                    <label className="text-sm" key={key}>
                      {
                        {
                          load: "Applied load",
                          indication: "Indication",
                          additionalWeights: "Additional weights",
                          zeroError: "Zero error",
                        }[key]
                      }{" "}
                      (g)
                      <input
                        required
                        inputMode="decimal"
                        value={o[key]}
                        className={field}
                        onChange={(e) =>
                          setObservations((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, [key]: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                {observations.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setObservations((rows) =>
                        rows.filter((_, i) => i !== index),
                      )
                    }
                    className="text-sm text-red-700 mt-3"
                  >
                    Remove observation
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              disabled={observations.length >= 100}
              onClick={() =>
                setObservations((rows) => [
                  ...rows,
                  {
                    testType: a.instrument.hasTare ? "TARE" : "WEIGHING",
                    load: "",
                    indication: "",
                    additionalWeights: "",
                    zeroError: "0",
                  },
                ])
              }
              className="text-teal-700 underline"
            >
              + Add observation
            </button>
            <label className="block">
              Inspection notes
              <textarea
                name="notes"
                required
                maxLength={4000}
                className={field}
                rows={3}
              />
            </label>
            <label className="block text-sm">
              <input type="checkbox" required className="mr-2" /> I recorded
              these observations during the physical inspection.
            </label>
            <button disabled={busy} className={button}>
              Save inspection and evaluate
            </button>
          </form>
        </section>
      )}
      {a.inspection && (
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-xl font-semibold">Inspection results</h2>
          <p className="mt-2 whitespace-pre-wrap">{a.inspection.notes}</p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  {[
                    "Test",
                    "Load (g)",
                    "Corrected error (g)",
                    "MPE (g)",
                    "Result",
                  ].map((h) => (
                    <th key={h} className="p-3 bg-slate-50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.inspection.observations.map((o: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{o.testType}</td>
                    <td className="p-3">{o.load}</td>
                    <td className="p-3">{o.evaluation.calculation.Ec.value}</td>
                    <td className="p-3">
                      {o.evaluation.rulePackage.mpeLimit?.value || "—"}
                    </td>
                    <td className="p-3 font-semibold">
                      {o.evaluation.compliance.verdict}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {officer && a.status === "INSPECTED" && (
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-xl font-semibold">Issue prototype certificate</h2>
          <p className="text-sm text-slate-500 mt-2">
            All recorded observations must pass. Choose the validity end under
            your reviewed pilot policy; no statutory duration is assumed.
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action("certify", {
                validUntil: new Date(String(f.get("validUntil"))).toISOString(),
              });
            }}
          >
            <label className="block max-w-md">
              Valid until (your local time)
              <input
                type="datetime-local"
                name="validUntil"
                required
                className={field}
              />
            </label>
            <button
              disabled={
                busy ||
                !a.inspection.observations.every(
                  (o: any) => o.evaluation.compliance.verdict === "PASS",
                )
              }
              className={button}
            >
              Issue certificate
            </button>
          </form>
        </section>
      )}
      {officer && ["SCHEDULED", "INSPECTED"].includes(a.status) && (
        <details className="bg-white border rounded-xl p-6">
          <summary className="cursor-pointer text-red-800">
            Reject application
          </summary>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              action("reject", {
                reason: new FormData(e.currentTarget).get("reason"),
              });
            }}
          >
            <label>
              Reason
              <textarea
                name="reason"
                required
                maxLength={2000}
                className={field}
              />
            </label>
            <button
              disabled={busy}
              className="bg-red-700 text-white rounded px-4 py-2"
            >
              Confirm rejection
            </button>
          </form>
        </details>
      )}
      {a.rejectionReason && (
        <p className="bg-red-50 text-red-800 p-4 rounded">
          Rejection reason: {a.rejectionReason}
        </p>
      )}
      {certificate && (
        <section className="bg-white border border-teal-200 rounded-xl p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-teal-700 font-semibold text-sm">
                QR-ENABLED PROTOTYPE CERTIFICATE
              </p>
              <h2 className="text-xl font-bold mt-2 break-all">
                {certificate.id}
              </h2>
              <p className="mt-3">
                Status: {certificate.status} · Valid until{" "}
                {new Date(certificate.validUntil).toLocaleString()}
              </p>
              <p className="mt-3 max-w-xl text-sm text-amber-900">
                {certificate.disclaimer}
              </p>
              <a
                href={certificate.verificationUrl}
                className="block underline text-teal-700 mt-4 break-all"
              >
                Open public verification page
              </a>
              <button
                onClick={() => window.print()}
                className="mt-4 border rounded px-4 py-2 print:hidden"
              >
                Print / Save as PDF
              </button>
              {user?.role === "Business" && (
                <button
                  disabled={busy}
                  onClick={renew}
                  className="ml-3 text-teal-700 underline print:hidden"
                >
                  Apply for re-verification
                </button>
              )}
            </div>
            <img
              src={certificate.qrDataUrl}
              alt="QR code linking to public certificate verification"
              width={180}
              height={180}
            />
          </div>
        </section>
      )}
      <section className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold text-xl">Application history</h2>
        <ol className="mt-4 space-y-4">
          {a.history.map((h: any, i: number) => (
            <li key={i} className="border-l-2 border-teal-200 pl-4">
              <p className="font-medium">{h.action}</p>
              <p className="text-sm text-slate-500">
                {new Date(h.at).toLocaleString()}
              </p>
              {h.note && <p className="text-sm break-all">{h.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
