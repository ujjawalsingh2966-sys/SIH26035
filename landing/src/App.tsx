import { 
  ArrowRight, 
  ExternalLink, 
  Activity, 
  CheckCircle2, 
  FileText, 
  Database, 
  Lock, 
  Scale, 
  Server,
  Settings,
  ShieldCheck,
  Video
} from 'lucide-react';

function App() {
  const prototypeUrl = import.meta.env.VITE_PROTOTYPE_URL;
  const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL;
  const githubUrl = import.meta.env.VITE_GITHUB_URL || "https://github.com/ujjawalsingh2966-sys/SIH26035";

  return (
    <div className="min-h-screen flex flex-col text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. NAVIGATION */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-blue-800" />
              <span className="font-bold text-xl tracking-tight text-blue-900">W8Lab</span>
            </div>
            <nav className="hidden md:flex space-x-6 text-sm font-medium text-slate-600">
              <a href="#how-it-works" className="hover:text-blue-700 transition-colors">How It Works</a>
              <a href="#trace" className="hover:text-blue-700 transition-colors">Metrology Trace</a>
              <a href="#evidence" className="hover:text-blue-700 transition-colors">Evidence</a>
              <a href="#technology" className="hover:text-blue-700 transition-colors">Technology</a>
              <a href="#references" className="hover:text-blue-700 transition-colors">References</a>
            </nav>
            <div className="flex items-center gap-4">
              <div className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200 hidden lg:block">
                SIH 2026 / SIH26035
              </div>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900 transition-colors font-medium">
                GitHub
              </a>
              <a href="#prototype" className="px-4 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-700 rounded-md transition-colors">
                Prototype
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* 2. HERO */}
        <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-8">
            <Activity className="w-4 h-4" />
            Prototype integration in progress
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
            From test observation to <span className="text-blue-800">traceable result.</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 font-medium mb-6">
            OIML R76-guided testing, evaluation & digital report generation.
          </p>
          <p className="text-lg text-slate-500 mb-10 max-w-3xl mx-auto leading-relaxed">
            Digital workflow for recording NAWI observations, performing supported metrological calculations, evaluating rule-linked results, and generating structured digital test reports.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="#how-it-works" className="inline-flex justify-center items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-800 hover:bg-blue-700 rounded-lg transition-colors">
              Explore the Workflow
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#prototype" className="inline-flex justify-center items-center gap-2 px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
              View Prototype
            </a>
          </div>
        </section>

        {/* 3. PROBLEM */}
        <section className="py-20 bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">The Challenge</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Manual Calculations", desc: "Prone to transcription and rounding errors during test execution." },
                { title: "Fragmented Observations", desc: "Test data is often scattered across paper records and spreadsheets." },
                { title: "Repetitive Reporting", desc: "Compiling results into standard formats is time-consuming." },
                { title: "Difficult Traceability", desc: "Tracing a final report back to the exact evaluation rule is complex." }
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-lg text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. HOW W8LAB WORKS */}
        <section id="how-it-works" className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">How W8Lab Works</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            
            <div className="space-y-4">
              {[
                { step: "1", title: "Observation", desc: "Record raw NAWI test observations into structured digital forms." },
                { step: "2", title: "Metrological Calculation", desc: "Execute decimal-safe formulas to compute derived metrological values." },
                { step: "3", title: "Rule Evaluation", desc: "Compare calculated values against versioned MPE compliance rules." },
                { step: "4", title: "Explainable Result", desc: "Generate a traceable step-by-step calculation pathway for each test." },
                { step: "5", title: "Review / Approval", desc: "Allow authorized evaluators to review the evidence and sign off." },
                { step: "6", title: "Digital Report", desc: "Output a structured, standardized test report containing all findings." }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xl">
                    {item.step}
                  </div>
                  <div className="flex-grow flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <h3 className="font-semibold text-lg text-slate-900 min-w-[220px]">{item.title}</h3>
                    <p className="text-slate-600 text-sm">{item.desc}</p>
                  </div>
                  {idx < 5 && (
                    <div className="hidden sm:block text-slate-300 mx-auto">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. METROLOGY TRACE */}
        <section id="trace" className="py-20 bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-12 items-center">
              <div className="lg:w-1/2 space-y-6">
                <h2 className="text-3xl font-bold text-white">Metrology Trace</h2>
                <p className="text-slate-300 text-lg leading-relaxed">
                  W8Lab focuses on capturing the exact mathematical pathway from observation to conclusion.
                </p>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg text-sm text-slate-400">
                  <p className="font-semibold text-slate-200 mb-1">Disclaimer</p>
                  <p className="mb-2">Full type evaluation is not represented by this single example.</p>
                  <p>Synthetic weighing example — recorded-observation result only.</p>
                </div>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-sm">
                  <div className="border-b border-slate-800 bg-slate-900 px-4 py-3 text-slate-300 font-semibold flex justify-between items-center">
                    <span>MPE Evaluation Trace</span>
                    <span className="px-2 py-1 bg-green-900/50 text-green-400 border border-green-800 rounded text-xs font-bold tracking-wide">
                      PASS
                    </span>
                  </div>
                  <div className="p-6 space-y-4 text-slate-300">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="text-slate-500">Instrument Class</div><div>Class III</div>
                      <div className="text-slate-500">Verification Scale Interval (e)</div><div>5 g</div>
                      <div className="text-slate-500">Zero Error (E0)</div><div>0 g</div>
                      <div className="col-span-2 border-t border-slate-800 my-2"></div>
                      <div className="text-slate-500">Indication (P)</div><div className="text-blue-300">5004.5 g</div>
                      <div className="text-slate-500">Error (E)</div><div>4.5 g</div>
                      <div className="text-slate-500">Corrected Error (Ec)</div><div>4.5 g</div>
                      <div className="text-slate-500">Load (m)</div><div>1000</div>
                      <div className="text-slate-500">MPE limit</div><div>5 g</div>
                    </div>
                    <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-400 text-xs uppercase mb-1 tracking-wider">Evaluation</div>
                      <div className="text-lg">|Ec| = 4.5 g &le; 5 g</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. WHY W8LAB */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Why W8Lab?</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "Decimal-based metrological calculation",
                "Rule-linked MPE evaluation",
                "Persisted calculation trace",
                "Rule version retained",
                "Review/approval workflow",
                "Structured digital report generation"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4">
                  <CheckCircle2 className="w-6 h-6 text-blue-700 flex-shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-800">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. EVIDENCE */}
        <section id="evidence" className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Current Verified Status</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mb-4" />
                <div className="text-4xl font-bold text-slate-900 mb-2">74</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Automated software tests passed</div>
                <p className="text-xs text-slate-400 mt-4 px-4">Software verification evidence</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
                <FileText className="w-10 h-10 text-blue-600 mb-4" />
                <div className="text-4xl font-bold text-slate-900 mb-2">3</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Named synthetic golden references</div>
                <p className="text-xs text-slate-400 mt-4 px-4">Synthetic reference cases</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
                <Server className="w-10 h-10 text-emerald-600 mb-4" />
                <div className="text-xl font-bold text-emerald-600 mb-2">Available</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Backend health verified</div>
                <a href="https://w8lab-api.onrender.com/api/v1/health/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-4 px-4 inline-flex items-center gap-1">
                  View Endpoint <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 8. CURRENT vs PLANNED & 11. TECHNOLOGY */}
        <section id="technology" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Architecture & Roadmap</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* CURRENT */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-500" />
                    Current Prototype
                  </h3>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 mb-8 text-sm text-slate-700">
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Node.js / Express API</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Decimal-based calculation engine</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Versioned supported MPE rules</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Evaluation + compliance pipeline</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> JSON persistence</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Development JWT login</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> Basic HTML/PDF report generation</li>
                  </ul>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Current Technology Stack</h4>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">Next.js / React / TypeScript / Tailwind</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">Node.js / Express / TypeScript</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">decimal.js</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">Jest / Supertest</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">JWT / Helmet / Validation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PLANNED */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-200 border-b border-slate-300 px-6 py-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-700" />
                    Planned Implementation
                  </h3>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 mb-8 text-sm text-slate-600">
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> PostgreSQL / Supabase</li>
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> Production authentication</li>
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> Database RLS</li>
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> Broader R76 test coverage</li>
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> Complete report-field coverage</li>
                    <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> Richer evidence/storage workflow</li>
                  </ul>
                  
                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Planned Technology Stack</h4>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded">PostgreSQL</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded">Supabase</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. PROTOTYPE & 10. DEMO VIDEO */}
        <section id="prototype" className="py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Evaluator Access</h2>
              <div className="w-16 h-1 bg-blue-500 mx-auto mt-4"></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex flex-col items-center text-center">
                <Lock className="w-12 h-12 text-slate-400 mb-6" />
                <h3 className="text-xl font-bold mb-2">Prototype</h3>
                <p className="text-slate-400 text-sm mb-8 flex-grow">
                  Access the live evaluator interface to test calculation logic and rule execution.
                </p>
                {prototypeUrl ? (
                  <a href={prototypeUrl} target="_blank" rel="noopener noreferrer" className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
                    Open W8Lab Prototype <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="w-full">
                    <button disabled className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-500 bg-slate-700 rounded-lg cursor-not-allowed">
                      Integration in progress
                    </button>
                    <p className="text-xs text-slate-500 mt-3">Prototype link will activate when the live frontend is configured.</p>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex flex-col items-center text-center">
                <Video className="w-12 h-12 text-slate-400 mb-6" />
                <h3 className="text-xl font-bold mb-2">Demo Video</h3>
                <p className="text-slate-400 text-sm mb-8 flex-grow">
                  Watch a complete walkthrough of the observation-to-report workflow.
                </p>
                {demoVideoUrl ? (
                   <a href={demoVideoUrl} target="_blank" rel="noopener noreferrer" className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors">
                     Watch Demo <ExternalLink className="w-4 h-4" />
                   </a>
                ) : (
                  <div className="w-full flex items-center justify-center h-[44px] bg-slate-700 border border-slate-600 rounded-lg">
                    <span className="text-sm font-medium text-slate-400">Demo video coming soon.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 12. RESEARCH & REFERENCES */}
        <section id="references" className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Research & References</h2>
              <div className="w-16 h-1 bg-blue-800 mx-auto mt-4"></div>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <a href="#" className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group block">
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-700">OIML R 76-1:2006</h4>
                <p className="text-xs text-slate-500 mt-1">Metrological and technical requirements</p>
              </a>
              <a href="#" className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group block">
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-700">OIML R 76-2:2007</h4>
                <p className="text-xs text-slate-500 mt-1">Test report format</p>
              </a>
              <a href="#" className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group block">
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-700">SIH26035</h4>
                <p className="text-xs text-slate-500 mt-1">Official problem context</p>
              </a>
              <a href="#" className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group block">
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-700">Legal Metrology</h4>
                <p className="text-xs text-slate-500 mt-1">Department of Consumer Affairs</p>
              </a>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group block">
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center gap-2">GitHub Repository <ExternalLink className="w-3 h-3" /></h4>
                <p className="text-xs text-slate-500 mt-1">Source code and architecture</p>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 13. FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-slate-400" />
              <span className="font-bold text-lg text-slate-700">W8Lab</span>
            </div>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-500">
              <span>SIH 2026</span>
              <span>SIH26035</span>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">GitHub</a>
              <a href="#prototype" className="hover:text-slate-900 transition-colors">Prototype</a>
              <a href="#references" className="hover:text-slate-900 transition-colors">References</a>
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-slate-400">
            &copy; 2026 W8Lab Team. Do not imply certified laboratory validation. Do not imply full OIML conformity/certification.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
