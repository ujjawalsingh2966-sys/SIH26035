export default function InstrumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold">Instrument Registry</h3>
        <button className="px-4 py-2 bg-slate-900 text-white font-medium rounded text-sm opacity-50 cursor-not-allowed">
          + Register Scale
        </button>
      </div>
      <div className="bg-white p-12 border rounded shadow-sm text-center text-slate-500">
        [PLACEHOLDER] Target domain integration point. Instrument Management module will be injected here.
      </div>
    </div>
  );
}
