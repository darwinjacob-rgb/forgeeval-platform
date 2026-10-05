import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Activity, 
  FileCode2, 
  Cpu, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  Layers, 
  Play, 
  Database,
  Lock,
  GitBranch,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';
import { Button, Badge, Card } from './CommonUI';

interface LandingPageProps {
  onNavigate: (view: string) => void;
  onOpenAnalysis: (subId?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onOpenAnalysis }) => {
  const [activeTab, setActiveTab] = useState<'flow' | 'telemetry' | 'evidence'>('flow');

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F5F5F2] selection:bg-[#FF6A1A] selection:text-[#08090B] relative">
      {/* Background Decorative Grids */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[640px] bg-radial-vignette pointer-events-none" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#292D32]/80 subtle-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-9 h-9 rounded-lg bg-[#FF6A1A] flex items-center justify-center font-black text-[#08090B] tracking-tighter text-lg orange-glow-sm">
              FV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-base text-[#F5F5F2] font-mono">FORGEVAL</span>
                <span className="text-[10px] bg-[#FF6A1A]/20 border border-[#FF6A1A]/40 text-[#FF8A3D] px-1.5 py-0.2 rounded font-mono font-semibold">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-[#92979D]">AI Hackathon Evaluation</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-mono uppercase tracking-wider text-[#92979D]">
            <a href="#features" className="hover:text-[#F5F5F2] transition-colors">Dimensions</a>
            <a href="#intelligence" className="hover:text-[#F5F5F2] transition-colors">Requirement Trace</a>
            <a href="#runtime" className="hover:text-[#F5F5F2] transition-colors">Runtime Harness</a>
            <a href="#judging" className="hover:text-[#F5F5F2] transition-colors">Judge Console</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('login')}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-36 border-b border-[#292D32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF6A1A]/30 bg-[#FF6A1A]/10 text-[#FF8A3D] text-xs font-mono mb-6">
              <span className="w-2 h-2 rounded-full bg-[#FF6A1A] animate-pulse" />
              <span>NEXT-GEN AI HACKATHON EVALUATION PLATFORM</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#F5F5F2] leading-[1.05] uppercase mb-6 font-mono">
              EVALUATE SUBMISSIONS. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A1A] via-[#FF8A3D] to-[#F5F5F2]">
                TRACE EVERY REQUIREMENT.
              </span> <br />
              MAKE JUDGING EVIDENCE-DRIVEN.
            </h1>

            <p className="text-base sm:text-lg text-[#92979D] max-w-2xl mx-auto leading-relaxed mb-8">
              Analyze hackathon codebases against complex problem specs across 8 distinct dimensions: 
              requirements, code quality, security vulnerabilities, runtime execution, unit coverage, and UI/UX.
            </p>
          </div>

          {/* Futuristic AI Evaluation Command Center Mockup */}
          <div className="relative rounded-2xl border border-[#292D32] bg-[#111316]/90 shadow-2xl p-3 sm:p-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF6A1A] to-transparent" />
            
            {/* Command Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#292D32] text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#FF5C5C]" />
                <span className="w-3 h-3 rounded-full bg-[#FFB547]" />
                <span className="w-3 h-3 rounded-full bg-[#45D483]" />
                <span className="text-[#92979D] pl-2 border-l border-[#292D32]">
                  SESSION: FORGE-CORE-HACK-EVAL-2026
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="orange" pulse>EVAL ENGINE: ACTIVE</Badge>
                <Badge variant="neutral">LATENCY: 1.2MS</Badge>
              </div>
            </div>

            {/* Inner Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
              {/* Left Column: Dimensions & Progress */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <div className="bg-[#181B1F] p-4 rounded-xl border border-[#292D32]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono font-bold uppercase text-[#F5F5F2] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#FF6A1A]" />
                      Multi-Dimensional Vector
                    </span>
                    <span className="text-xs font-mono text-[#45D483] font-bold">94.8% ACC</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Requirement Trace', score: 95, color: 'bg-[#FF6A1A]' },
                      { name: 'AST & Code Quality', score: 92, color: 'bg-[#FF8A3D]' },
                      { name: 'Kernel & Sec Audit', score: 97, color: 'bg-[#45D483]' },
                      { name: 'Runtime Sandbox Exec', score: 94, color: 'bg-[#FF6A1A]' },
                      { name: 'UI / UX Interaction', score: 89, color: 'bg-[#38BDF8]' }
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-[#92979D]">{item.name}</span>
                          <span className="text-[#F5F5F2]">{item.score}/100</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#111316] rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#181B1F] p-4 rounded-xl border border-[#292D32]">
                  <span className="text-xs font-mono uppercase text-[#92979D] block mb-2">TARGET EVALUATION</span>
                  <div className="text-sm font-bold text-[#F5F5F2] font-mono">Aetheris Protocol Labs</div>
                  <div className="text-xs text-[#92979D] font-mono truncate mt-0.5">github.com/aetheris-labs/sentinel-engine-v2</div>
                  <div className="mt-3 pt-3 border-t border-[#292D32] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#92979D]">COMMIT</span>
                    <span className="text-[#FF8A3D]">#7f9a2c3</span>
                  </div>
                </div>
              </div>

              {/* Center Column: Live Evidence Stream */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="bg-[#08090B] border border-[#292D32] rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[#292D32] mb-3">
                    <span className="text-[#F5F5F2] font-bold flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#45D483]" />
                      REALTIME REQ EVIDENCE MAPPING & AST VERIFICATION
                    </span>
                    <span className="text-[#92979D]">STREAM: #00492</span>
                  </div>
                  
                  <div className="space-y-2.5 max-h-56 overflow-y-auto">
                    <div className="p-2.5 rounded bg-[#111316] border border-[#292D32] flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#45D483] shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#FF8A3D] font-bold">[REQ-SEC-01]</span>
                          <span className="text-[#F5F5F2]">Memory-safe buffer deserialization verified</span>
                        </div>
                        <p className="text-[11px] text-[#92979D] mt-1">
                          Source matched: <span className="text-[#45D483]">crates/sentinel-core/src/verifier.rs:44</span> (Confidence 98%)
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#111316] border border-[#292D32] flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#45D483] shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#FF8A3D] font-bold">[REQ-PERF-01]</span>
                          <span className="text-[#F5F5F2]">P99 execution latency threshold assertion</span>
                        </div>
                        <p className="text-[11px] text-[#92979D] mt-1">
                          k6 stress report: <span className="text-[#45D483]">4.62ms measured</span> vs target &lt; 4.8ms. Condition PASSED.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#111316] border border-[#FFB547]/30 flex items-start gap-3">
                      <Activity className="w-4 h-4 text-[#FFB547] shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#FFB547] font-bold">[REQ-FUNC-02]</span>
                          <span className="text-[#F5F5F2]">Money laundering ring graph traversal</span>
                        </div>
                        <p className="text-[11px] text-[#92979D] mt-1">
                          Partial match: Depth limited to 2 hops, requirement specified 3 hops. Marked PARTIAL.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Micro Metric Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#181B1F] p-3 rounded-lg border border-[#292D32]">
                    <span className="text-[10px] font-mono text-[#92979D] uppercase">Code Quality</span>
                    <div className="text-xl font-bold font-mono text-[#F5F5F2] mt-0.5">92 / 100</div>
                  </div>
                  <div className="bg-[#181B1F] p-3 rounded-lg border border-[#292D32]">
                    <span className="text-[10px] font-mono text-[#92979D] uppercase">Security Flaws</span>
                    <div className="text-xl font-bold font-mono text-[#45D483] mt-0.5">0 Critical</div>
                  </div>
                  <div className="bg-[#181B1F] p-3 rounded-lg border border-[#292D32]">
                    <span className="text-[10px] font-mono text-[#92979D] uppercase">Test Coverage</span>
                    <div className="text-xl font-bold font-mono text-[#F5F5F2] mt-0.5">91.5%</div>
                  </div>
                  <div className="bg-[#181B1F] p-3 rounded-lg border border-[#292D32]">
                    <span className="text-[10px] font-mono text-[#92979D] uppercase">Confidence</span>
                    <div className="text-xl font-bold font-mono text-[#FF8A3D] mt-0.5">96.4%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: How ForgeEval Works */}
      <section id="features" className="py-24 border-b border-[#292D32] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
            <div>
              <span className="text-xs font-mono uppercase text-[#FF6A1A] tracking-widest block mb-2">
                // ARCHITECTURAL WORKFLOW
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-mono text-[#F5F5F2] uppercase">
                How ForgeEval Works
              </h2>
            </div>
            <p className="text-sm font-mono text-[#92979D] max-w-md">
              From repository ingestion to sandbox execution and judge consensus in minutes, not days.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Spec Ingestion',
                desc: 'Upload multi-tiered problem statements, defining exact input/output payloads, architectural constraints, and performance ceilings.'
              },
              {
                step: '02',
                title: 'AST & Code Analysis',
                desc: 'Deep syntactic parsing of repositories, resolving AST calls, dependency risk signatures, and cyclomatic complexity curves.'
              },
              {
                step: '03',
                title: 'Sandboxed Runtime',
                desc: 'Deterministic compilation inside eBPF-monitored microVMs. Run automated test suites, measure memory peaks and latency targets.'
              },
              {
                step: '04',
                title: 'Evidence-Led Scoring',
                desc: 'Judges receive highlighted source lines, trace artifacts, and AI confidence vectors rather than subjective pitch decks.'
              }
            ].map((card, i) => (
              <div key={i} className="bg-[#111316] border border-[#292D32] p-6 rounded-xl relative group hover:border-[#FF6A1A]/50 transition-colors">
                <div className="text-3xl font-black font-mono text-[#292D32] group-hover:text-[#FF6A1A] transition-colors mb-4">
                  {card.step}
                </div>
                <h3 className="text-lg font-bold font-mono text-[#F5F5F2] mb-2">{card.title}</h3>
                <p className="text-sm text-[#92979D] leading-relaxed">{card.desc}</p>
                <div className="w-8 h-0.5 bg-[#FF6A1A] mt-5 opacity-40 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Dimensional Evaluation Matrix */}
      <section className="py-24 border-b border-[#292D32] bg-[#0c0d10]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase text-[#FF6A1A] tracking-widest block mb-2">
              // RIGOROUS METRIC SYSTEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-mono text-[#F5F5F2] uppercase mb-4">
              Multi-Dimensional Evaluation
            </h2>
            <p className="text-sm text-[#92979D]">
              Judging hackathons should not be a popularity contest. Every project is measured across verified engineering dimensions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <FileCode2 className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'Requirement Intelligence',
                details: 'AI maps natural language prompt requirements directly to code lines, functions, and API routes with confidence scoring.'
              },
              {
                icon: <Cpu className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'Code Intelligence',
                details: 'Architectural analysis, language idiomaticity, dependency tree health, dead-code detection, and modular separation.'
              },
              {
                icon: <ShieldCheck className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'Security & Vulnerability',
                details: 'Static taint analysis detecting command injection, exposed secrets, unchecked JWT algorithms, and unvalidated memory buffers.'
              },
              {
                icon: <Terminal className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'Runtime Verification',
                details: 'Isolated execution measuring cold start duration, peak RSS memory consumption, and actual API latency under load.'
              },
              {
                icon: <Activity className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'Test Rigor',
                details: 'Evaluates unit test completeness, edge-case resilience, mock boundary quality, and actual branch coverage percentages.'
              },
              {
                icon: <Award className="w-5 h-5 text-[#FF6A1A]" />,
                name: 'UI/UX & Evidence',
                details: 'Assesses interface usability, responsiveness, styling coherence, and verifies visual assets against requirements.'
              }
            ].map((dim, idx) => (
              <div key={idx} className="bg-[#111316] border border-[#292D32] p-6 rounded-xl hover:border-[#FF6A1A]/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#181B1F] border border-[#292D32] flex items-center justify-center mb-4">
                  {dim.icon}
                </div>
                <h3 className="text-base font-bold font-mono text-[#F5F5F2] mb-2">{dim.name}</h3>
                <p className="text-xs text-[#92979D] leading-relaxed">{dim.details}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6A1A] mx-auto flex items-center justify-center text-[#08090B] font-black text-2xl mb-8 orange-glow">
            FV
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-mono uppercase text-[#F5F5F2] mb-6">
            Ready to Run Evidence-Based Hackathons?
          </h2>
          <p className="text-base text-[#92979D] max-w-xl mx-auto font-mono">
            Empower organizers, engineers, and judges with automated code intelligence and verifiability.
          </p>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-[#292D32] py-8 text-xs font-mono text-[#92979D] bg-[#08090B]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6A1A]" />
            <span className="text-[#F5F5F2] font-bold">FORGEVAL</span>
            <span>— AI-Powered Hackathon Evaluation Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate('login')} className="hover:text-[#F5F5F2]">Admin Login</button>
            <button onClick={() => onNavigate('register')} className="hover:text-[#F5F5F2]">Register Account</button>
            <button onClick={() => onNavigate('results')} className="hover:text-[#F5F5F2]">Final Results</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
