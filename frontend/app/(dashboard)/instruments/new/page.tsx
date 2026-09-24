'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewInstrumentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState(' ');

  const [formData, setFormData] = useState({
    manufacturerId: 'mfr_placeholder', // Skipping explicit manufacturer select for brevity
    name: '',
    model: '',
    serialNumber: '',

    // Gate properties
    isWeighing: true,
    isManual: true,
    isElectronic: true,
    isSingleRange: true,

    // Config limits
    accuracyClass: 'III',
    maxCapacity: '',
    minCapacity: '',
    e: '',
    d: '',
    hasTare: false
  });

  const handleCreate = async () => {
    // Basic verification gate
    if (!formData.isWeighing || !formData.isManual || !formData.isElectronic || !formData.isSingleRange) {
      setError('OUT_OF_SCOPE: Instrument does not meet OIML R76 MVP criteria.');
      return;
    }

    try {
      const res = await fetch('http://localhost:4000/api/v1/instruments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer placeholder-tech-token'
        },
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      if (result.success) {
        // Automatically create a draft test case to attach observations
        const tcRes = await fetch('http://localhost:4000/api/v1/test-cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer placeholder-tech-token'
          },
          body: JSON.stringify({ instrumentId: result.data.id })
        });
        const tcData = await tcRes.json();
        if (tcData.success) {
          router.push(`/test-cases/${tcData.data.id}/workspace`);
        }
      } else {
        setError(result.error || 'Failed to create instrument');
      }
    } catch (err) {
      setError('Network error connecting to API');
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 font-mono text-blue-900 border-b pb-2">CREATE INSTRUMENT RECORD</h1>

      {error !== ' ' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 font-mono font-bold">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Statutory Classification Gate</h2>
          <div className="p-4 border bg-gray-50 rounded space-y-4">
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={formData.isWeighing} onChange={e => setFormData({...formData, isWeighing: e.target.checked})} className="w-5 h-5" />
              <span className="font-mono">Is it a Weighing Instrument?</span>
            </label>
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={formData.isManual} onChange={e => setFormData({...formData, isManual: e.target.checked})} className="w-5 h-5" />
              <span className="font-mono">Does it require manual intervention? (NAWI)</span>
            </label>
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={formData.isElectronic} onChange={e => setFormData({...formData, isElectronic: e.target.checked})} className="w-5 h-5" />
              <span className="font-mono">Is it fully Electronic?</span>
            </label>
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={formData.isSingleRange} onChange={e => setFormData({...formData, isSingleRange: e.target.checked})} className="w-5 h-5" />
              <span className="font-mono">Is it a Single-Range instrument?</span>
            </label>
          </div>
          <button onClick={() => setStep(2)} className="bg-blue-600 outline-none text-white px-6 py-2 rounded font-mono font-bold hover:bg-blue-700">CONTINUE TO METADATA</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Core Metadata & Limits</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Name (e.g. Sartorius 200)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="border p-2 rounded" />
            <input placeholder="Model" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="border p-2 rounded" />
            <input placeholder="Serial Number" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className="border p-2 rounded" />

            <select value={formData.accuracyClass} onChange={e => setFormData({...formData, accuracyClass: e.target.value})} className="border p-2 rounded font-mono">
              <option value="I">Class I (Special)</option>
              <option value="II">Class II (High)</option>
              <option value="III">Class III (Medium)</option>
              <option value="IIII">Class IIII (Ordinary)</option>
            </select>

            <input placeholder="Max Capacity (String strictly)" value={formData.maxCapacity} onChange={e => setFormData({...formData, maxCapacity: e.target.value})} className="border p-2 rounded font-mono bg-blue-50" />
            <input placeholder="Min Capacity" value={formData.minCapacity} onChange={e => setFormData({...formData, minCapacity: e.target.value})} className="border p-2 rounded font-mono bg-blue-50" />
            <input placeholder="Verification Scale Interval (e)" value={formData.e} onChange={e => setFormData({...formData, e: e.target.value})} className="border p-2 rounded font-mono bg-blue-50" />
            <input placeholder="Actual Scale Interval (d)" value={formData.d} onChange={e => setFormData({...formData, d: e.target.value})} className="border p-2 rounded font-mono bg-blue-50" />
          </div>

          <label className="flex items-center space-x-3 mt-4">
            <input type="checkbox" checked={formData.hasTare} onChange={e => setFormData({...formData, hasTare: e.target.checked})} className="w-5 h-5" />
            <span className="font-mono">Equipped with Tare device?</span>
          </label>

          <div className="flex space-x-4 mt-6">
            <button onClick={() => setStep(1)} className="bg-gray-200 outline-none text-gray-800 px-6 py-2 rounded font-mono font-bold hover:bg-gray-300">BACK</button>
            <button onClick={handleCreate} className="bg-green-600 outline-none text-white px-6 py-2 rounded font-mono font-bold hover:bg-green-700">SUBMIT & INITIATE TEST</button>
          </div>
        </div>
      )}
    </div>
  );
}
