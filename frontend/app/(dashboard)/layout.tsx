export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-slate-100 font-mono">
      {/* Sidebar Mock */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-16 flex items-center px-4 font-bold text-lg border-b border-slate-800">
          NAWI System
        </div>
        <nav className="flex-1 py-4 space-y-2">
          <a href="/dashboard" className="block px-4 py-2 hover:bg-slate-800 text-slate-300">Overview</a>
          <a href="/instruments" className="block px-4 py-2 hover:bg-slate-800 text-slate-300">Instruments</a>
          <a href="/tests" className="block px-4 py-2 hover:bg-slate-800 text-slate-300">Evaluation Queue</a>
        </nav>
        <div className="p-4 border-t border-slate-800 text-sm text-slate-500">
          Role: Foundation Admin
        </div>
      </div>
      
      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold text-slate-800">Laboratory Dashboard</h2>
          <a href="/login" className="text-sm font-medium text-blue-600">Sign Out</a>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
