export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl max-w-sm w-full border border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-6">NAWI Platform</h1>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email (Role)</label>
            <input 
              type="email" 
              placeholder="technician@example.com"
              className="mt-1 block w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input 
              type="password" 
              defaultValue="dev-demo-password"
              className="mt-1 block w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <button 
            type="button" 
            onClick={() => window.location.href = '/dashboard'}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            Development Sign In
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500 text-center">
          PHASE 4 FOUNDATION DEMO
        </p>
      </div>
    </div>
  );
}
