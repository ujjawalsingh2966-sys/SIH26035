'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TestCaseWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [testCase, setTestCase] = useState<any>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('WEIGHING');

  const [lab, setLab] = useState({ temperature: '', humidity: '', pressure: '' });

  // Observation form
  const [obsForm, setObsForm] = useState({
    load: '',
    indication: '',
    additionalWeights: '0'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('nawi_token');
      // Fetch test case
      const tcRes = await fetch(`http://localhost:4000/api/v1/test-cases`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const tcData = await tcRes.json();
      const currentTc = tcData.data?.find((t: any) => t.id === params.id);

      setTestCase(currentTc);
      if (currentTc?.laboratoryConditions) {
        setLab(currentTc.laboratoryConditions);
      }

      // Fetch observations
      const obsRes = await fetch(`http://localhost:4000/api/v1/observations/${params.id}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const obsData = await obsRes.json();
      setObservations(obsData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveLabConditions = async () => {
    const token = localStorage.getItem('nawi_token');
    await fetch(`http://localhost:4000/api/v1/test-cases/${params.id}/laboratory-conditions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(lab)
    });
    alert('Conditions saved');
  };

  const addObservation = async () => {
    // Determine max sequence
    const typeObs = observations.filter(o => o.testType === activeTab);
    const seq = typeObs.length + 1;
    const token = localStorage.getItem('nawi_token');

    const res = await fetch(`http://localhost:4000/api/v1/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        testCaseId: params.id,
        testType: activeTab,
        sequence: seq,
        load: obsForm.load,
        indication: obsForm.indication,
        additionalWeights: obsForm.additionalWeights
      })
    });
    const result = await res.json();
    if (result.success) {
      setObservations([...observations, result.data]);
      setObsForm({ load: '', indication: '', additionalWeights: '0' }); // Reset form
    }
  };

  const submitTest = async () => {
    if (!confirm('Are you sure you want to submit this test case for review? Observations will be locked.')) return;
    const token = localStorage.getItem('nawi_token');

    await fetch(`http://localhost:4000/api/v1/test-cases/${params.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'SUBMITTED_FOR_REVIEW' })
    });
    router.push('/');
  };

  if (loading) return <div className="p-8">Loading workspace...</div>;
  if (!testCase) return <div className="p-8">Test Case not found.</div>;

  const isLocked = testCase.status === 'SUBMITTED_FOR_REVIEW';

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Left Column: Metadata & Environmental */}
      <div className="w-full md:w-1/3 space-y-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded">
          <h2 className="font-bold font-mono text-blue-900 border-b border-blue-200 pb-2 mb-2">METADATA</h2>
          <div className="text-sm font-mono space-y-1">
            <p><strong>Test Case:</strong> {testCase.id}</p>
            <p><strong>Status:</strong> {testCase.status}</p>
            <p><strong>Instrument ID:</strong> {testCase.instrumentId}</p>
          </div>
        </div>

        <div className="bg-gray-50 border p-4 rounded">
          <h2 className="font-bold font-mono pb-2 mb-2">LAB CONDITIONS</h2>
          <div className="space-y-3 font-mono text-sm">
            <div>
              <label className="block mb-1">Temperature (°C)</label>
              <input disabled={isLocked} value={lab.temperature} onChange={e => setLab({...lab, temperature: e.target.value})} className="border p-2 w-full rounded" />
            </div>
            <div>
              <label className="block mb-1">Humidity (%)</label>
              <input disabled={isLocked} value={lab.humidity} onChange={e => setLab({...lab, humidity: e.target.value})} className="border p-2 w-full rounded" />
            </div>
            <div>
              <label className="block mb-1">Pressure (hPa)</label>
              <input disabled={isLocked} value={lab.pressure} onChange={e => setLab({...lab, pressure: e.target.value})} className="border p-2 w-full rounded" />
            </div>
            {!isLocked && (
              <button onClick={saveLabConditions} className="bg-blue-600 text-white px-4 py-2 w-full rounded font-bold hover:bg-blue-700">SAVE CONDITIONS</button>
            )}
          </div>
        </div>

        {!isLocked && (
          <button onClick={submitTest} className="mt-8 bg-green-600 outline-none text-white px-6 py-3 w-full rounded font-mono font-bold hover:bg-green-700">
            SUBMIT FOR REVIEW
          </button>
        )}
      </div>

      {/* Right Column: Observation Workspace */}
      <div className="w-full md:w-2/3 border p-6 rounded bg-white shadow-sm">
        <h2 className="text-xl font-bold font-mono mb-4 text-gray-800">OBSERVATION WORKSPACE</h2>

        {/* Tabs based on applicable tests */}
        <div className="flex border-b mb-6 font-mono text-sm overflow-x-auto">
          {Object.entries(testCase.testConfiguration).map(([testKey, status]) => {
            // Note status checks can be added here
            if (status === 'NOT APPLICABLE') return null;
            const tabName = testKey.toUpperCase().replace('SETTING', '_SETTING');
            return (
              <button
                key={testKey}
                onClick={() => setActiveTab(tabName)}
                className={`py-2 px-4 whitespace-nowrap ${activeTab === tabName ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {tabName}
              </button>
            );
          })}
        </div>

        {/* Input Form */}
        {!isLocked && (
          <div className="bg-gray-100 p-4 rounded mb-6 flex gap-4 flex-wrap items-end font-mono">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs mb-1 font-bold">Load ($L$)</label>
              <input
                className="border p-2 w-full rounded bg-white"
                placeholder="String strict"
                value={obsForm.load}
                onChange={e => setObsForm({...obsForm, load: e.target.value})}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs mb-1 font-bold">Indication ($I$)</label>
              <input
                className="border p-2 w-full rounded bg-white"
                placeholder="String strict"
                value={obsForm.indication}
                onChange={e => setObsForm({...obsForm, indication: e.target.value})}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs mb-1 font-bold">Add. Weights ($\Delta L$)</label>
              <input
                className="border p-2 w-full rounded bg-white"
                placeholder="String strict"
                value={obsForm.additionalWeights}
                onChange={e => setObsForm({...obsForm, additionalWeights: e.target.value})}
              />
            </div>
            <button onClick={addObservation} className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-black font-bold h-10">
              RECORD
            </button>
          </div>
        )}

        {/* Readings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-3">Seq</th>
                <th className="p-3">Load (L)</th>
                <th className="p-3">Indication (I)</th>
                <th className="p-3">$\\Delta$ L</th>
              </tr>
            </thead>
            <tbody>
              {observations.filter(o => o.testType === activeTab).map(obs => (
                <tr key={obs.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">#{obs.sequence}</td>
                  <td className="p-3 font-semibold text-blue-800 bg-blue-50">{obs.load}</td>
                  <td className="p-3 font-semibold text-green-800 bg-green-50">{obs.indication}</td>
                  <td className="p-3 font-semibold text-purple-800 bg-purple-50">{obs.additionalWeights}</td>
                </tr>
              ))}
              {observations.filter(o => o.testType === activeTab).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-400">
                    No observations recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mathematical isolation guarantee disclaimer */}
        <div className="mt-8 text-xs text-gray-400 font-mono border-t pt-4">
          PHASE 5 COMPLIANCE: Raw observation inputs ($L, I, \Delta L$) are persisted strictly as strings. Mathematical derivation of $P$ and $E_c$ is deferred to Phase 6 arbitrary-precision calculation engine.
        </div>
      </div>
    </div>
  );
}
