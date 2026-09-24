'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlusCircle, Search } from 'lucide-react';

export default function DashboardPage() {
  const [instruments, setInstruments] = useState<any[]>([]);
  const [testCases, setTestCases] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:4000/api/v1/instruments')
      .then(res => res.json())
      .then(data => setInstruments(data.data || []))
      .catch(console.error);

    fetch('http://localhost:4000/api/v1/test-cases')
      .then(res => res.json())
      .then(data => setTestCases(data.data || []))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold font-mono text-gray-800">WORKSPACE OVERVIEW</h1>
        <Link href="/instruments/new" className="bg-blue-600 outline-none text-white px-5 py-2 rounded font-mono font-bold hover:bg-blue-700 flex items-center gap-2">
          <PlusCircle size={18} />
          INTAKE NEW INSTRUMENT
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Active Test Cases */}
        <div className="bg-white border rounded shadow-sm">
          <div className="bg-gray-50 border-b p-4">
            <h2 className="font-bold font-mono text-gray-800">ACTIVE TEST CASES</h2>
          </div>
          <div className="p-4 space-y-4 font-mono text-sm">
            {testCases.length === 0 ? (
              <p className="text-gray-500 italic">No tests in progress.</p>
            ) : (
              testCases.map(tc => (
                <div key={tc.id} className="border p-4 rounded flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <div className="font-bold text-blue-900">{tc.id}</div>
                    <div className="text-gray-500">Instrument: {tc.instrumentId}</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      tc.status === 'SUBMITTED_FOR_REVIEW' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tc.status}
                    </span>
                    <div className="mt-2 text-blue-600 hover:underline">
                      <Link href={`/test-cases/${tc.id}/workspace`}>OPEN WORKSPACE &rarr;</Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instrument Inventory */}
        <div className="bg-white border rounded shadow-sm">
          <div className="bg-gray-50 border-b p-4">
            <h2 className="font-bold font-mono text-gray-800">INSTRUMENT INVENTORY</h2>
          </div>
          <div className="p-4 space-y-4 font-mono text-sm">
            {instruments.length === 0 ? (
              <p className="text-gray-500 italic">No instruments registered.</p>
            ) : (
              instruments.map(inst => (
                <div key={inst.id} className="border p-4 rounded hover:bg-gray-50">
                  <div className="font-bold">{inst.name} ({inst.model})</div>
                  <div className="text-gray-500">SN: {inst.serialNumber} | Class: {inst.accuracyClass || 'N/A'}</div>
                  <div className="mt-2 text-xs flex gap-2">
                    <span className="bg-blue-50 text-blue-800 px-2 rounded border border-blue-200">Max: {inst.maxCapacity || '-'}</span>
                    <span className="bg-blue-50 text-blue-800 px-2 rounded border border-blue-200">e: {inst.e || '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <div className="p-4 bg-green-50 text-green-900 border border-green-200 rounded font-mono text-sm mt-8">
        <strong>Phase 5 Integration Status:</strong> Backend connected. Instrument statuary limits mapped. Test configurations auto-derived via Applicability Matrix. Mathematical calculations isolated safely to string buffers prior to Phase 6 implementation.
      </div>
    </div>
  );
}
