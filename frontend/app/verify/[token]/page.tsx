"use client";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../lib/api";
export default function VerifyPage({ params }: { params: { token: string } }) {
  const [certificate, setCertificate] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(
      `${API_BASE_URL}/api/v1/verification/public/certificates/${encodeURIComponent(params.token)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error?.message || "Certificate not found");
        return b.data;
      })
      .then(setCertificate)
      .catch((e) => setError(e.message));
  }, [params.token]);
  return (
    <main className="min-h-screen bg-slate-950 p-5 flex items-center justify-center">
      <section className="max-w-2xl w-full bg-white rounded-2xl p-6 md:p-10">
        <p className="text-teal-700 font-bold tracking-widest text-sm">
          W8LAB · PUBLIC VERIFICATION
        </p>
        <h1 className="text-3xl font-bold mt-4">Certificate lookup</h1>
        {error ? (
          <p role="alert" className="mt-6 bg-red-50 text-red-800 p-4 rounded">
            {error}
          </p>
        ) : !certificate ? (
          <p role="status" className="mt-6">
            Checking certificate…
          </p>
        ) : (
          <>
            <p
              className={`inline-block px-4 py-2 rounded-full mt-6 font-semibold ${certificate.status === "VALID" ? "bg-teal-100 text-teal-900" : "bg-red-100 text-red-900"}`}
            >
              {certificate.status === "VALID"
                ? "Within recorded validity"
                : "Expired"}
            </p>
            <dl className="mt-6 space-y-4">
              {[
                ["Certificate ID", certificate.id],
                ["Instrument", certificate.instrumentName],
                ["Model", certificate.model],
                ["Serial number", certificate.serialNumber],
                ["Issued", new Date(certificate.issuedAt).toLocaleString()],
                [
                  "Valid until",
                  new Date(certificate.validUntil).toLocaleString(),
                ],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-slate-500">{key}</dt>
                  <dd className="font-medium break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 bg-amber-50 text-amber-900 p-4 rounded text-sm">
              {certificate.disclaimer}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
