import React, { useState } from 'react';
import { 
  FolderGit2, 
  ExternalLink, 
  Play, 
  ArrowLeft, 
  Code2, 
  FileCode, 
  Folder, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Shield, 
  Terminal,
  Activity,
  Cpu
} from 'lucide-react';
import { Submission, Problem } from '../types';
import { Card, Badge, Button, ProgressBar } from './CommonUI';

interface SubmissionDetailProps {
  submission: Submission;
  problem?: Problem;
  onNavigate: (view: string) => void;
  onRunAnalysis: (subId: string) => void;
}

export const SubmissionDetail: React.FC<SubmissionDetailProps> = ({
  submission,
  problem,
  onNavigate,
  onRunAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'readme' | 'dependencies'>('overview');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back and Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#292D32]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => onNavigate('submissions')}>
            Submissions
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-[#F5F5F2] uppercase">
                {submission.team}
              </h1>
              <Badge variant={
                submission.ingestionStatus === 'READY' ? 'success' :
                submission.ingestionStatus === 'FAILED' ? 'danger' :
                submission.ingestionStatus === 'CLONING' || submission.ingestionStatus === 'INGESTING' ? 'orange' :
                submission.status === 'ANALYZED' ? 'success' : 'orange'
              }>
                {submission.ingestionStatus ? `REPO: ${submission.ingestionStatus}` : submission.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-[#92979D]">
              Target: <span className="text-[#FF8A3D]">{submission.problemTitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={submission.githubUrl || submission.repository}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] hover:border-[#FF6A1A]/40 text-xs font-mono transition-colors"
          >
            <FolderGit2 className="w-4 h-4 text-[#FF6A1A]" />
            <span>OPEN REPO</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#92979D]" />
          </a>

          <Button
            variant="primary"
            size="sm"
            icon={<Play className="w-4 h-4" />}
            onClick={() => onRunAnalysis(submission.id)}
          >
            RUN AI ANALYSIS
          </Button>
        </div>
      </div>

      {/* Repository Ingestion Specification (Phase 1B) */}
      <div className="bg-[#111316] border border-[#292D32] p-4 rounded-xl font-mono text-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF6A1A]/10 border border-[#FF6A1A]/30 flex items-center justify-center shrink-0">
              <FolderGit2 className="w-5 h-5 text-[#FF6A1A]" />
            </div>
            <div>
              <span className="text-[10px] text-[#92979D] uppercase block">GitHub Repository</span>
              <a
                href={submission.githubUrl || submission.repository}
                target="_blank"
                rel="noreferrer"
                className="text-[#FF8A3D] font-bold hover:underline flex items-center gap-1.5"
              >
                <span>{(submission.githubUrl || submission.repository).replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="w-3 h-3 text-[#92979D]" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-[#92979D] uppercase block mb-1">Repository Status</span>
              <Badge variant={
                submission.ingestionStatus === 'READY' ? 'success' :
                submission.ingestionStatus === 'FAILED' ? 'danger' :
                submission.ingestionStatus === 'CLONING' || submission.ingestionStatus === 'INGESTING' ? 'orange' :
                'neutral'
              }>
                {submission.ingestionStatus || 'READY'}
              </Badge>
            </div>
            <div>
              <span className="text-[10px] text-[#92979D] uppercase block mb-1">Files</span>
              <span className="text-[#F5F5F2] font-bold">
                {submission.repoMetadata?.fileCount !== undefined
                  ? submission.repoMetadata.fileCount
                  : submission.metrics?.linesOfCode ? Math.round(submission.metrics.linesOfCode / 40) : 127}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#92979D] uppercase block mb-1">README</span>
              <span className={submission.repoMetadata?.hasReadme !== false ? "text-emerald-400 font-bold" : "text-[#92979D]"}>
                {submission.repoMetadata?.hasReadme !== false ? 'Available' : 'None detected'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#92979D] uppercase block mb-1">Repository Stack</span>
              <span className="text-[#FF8A3D] font-bold truncate max-w-[180px] block">
                {submission.repoMetadata?.frameworks?.length
                  ? submission.repoMetadata.frameworks.join(' + ')
                  : submission.frameworks?.join(' + ') || submission.language}
              </span>
            </div>
          </div>
        </div>

        {submission.ingestionStatus === 'FAILED' && submission.ingestionError && (
          <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ingestion Error: </span>
              <span>{submission.ingestionError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Composite Score</span>
          <div className="text-2xl font-bold text-[#45D483] mt-1">{submission.overallScore.toFixed(1)}</div>
          <span className="text-[10px] text-[#92979D]">Out of 100</span>
        </div>

        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Lines of Code</span>
          <div className="text-2xl font-bold text-[#F5F5F2] mt-1">{submission.metrics.linesOfCode.toLocaleString()}</div>
          <span className="text-[10px] text-[#92979D]">Analyzed AST</span>
        </div>

        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Test Coverage</span>
          <div className="text-2xl font-bold text-[#FF8A3D] mt-1">{submission.metrics.testCoverage}%</div>
          <span className="text-[10px] text-[#92979D]">Branch verified</span>
        </div>

        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Complexity</span>
          <div className="text-2xl font-bold text-[#F5F5F2] mt-1">{submission.metrics.cyclomaticComplexity}</div>
          <span className="text-[10px] text-[#92979D]">Avg cyclomatic</span>
        </div>

        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Build Latency</span>
          <div className="text-2xl font-bold text-[#F5F5F2] mt-1">{submission.metrics.buildTimeSec}s</div>
          <span className="text-[10px] text-[#45D483]">Clean release</span>
        </div>

        <div className="bg-[#111316] border border-[#292D32] p-3 rounded-xl font-mono">
          <span className="text-[10px] text-[#92979D] uppercase block">Security Flaws</span>
          <div className={`text-2xl font-bold mt-1 ${submission.metrics.vulnerabilitiesCount > 0 ? 'text-[#FFB547]' : 'text-[#45D483]'}`}>
            {submission.metrics.vulnerabilitiesCount} CVE
          </div>
          <span className="text-[10px] text-[#92979D]">In dependency tree</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#292D32] gap-4 font-mono text-xs">
        {[
          { id: 'overview', label: 'Score Breakdown & Stack' },
          { id: 'structure', label: 'Repository Tree Structure' },
          { id: 'readme', label: 'Parsed README Specification' },
          { id: 'dependencies', label: `Dependencies & Audit (${submission.dependencies.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 border-b-2 transition-colors uppercase ${
              activeTab === tab.id
                ? 'border-[#FF6A1A] text-[#FF8A3D] font-bold'
                : 'border-transparent text-[#92979D] hover:text-[#F5F5F2]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <Card title="Multi-Dimensional Dimension Breakdown" badge={<Badge variant="orange">EVAL MATRIX</Badge>}>
              <div className="space-y-4">
                {[
                  { name: 'Requirement Compliance', val: submission.criteriaScores.requirement, icon: <Layers className="w-4 h-4 text-[#FF6A1A]" /> },
                  { name: 'Code Quality & AST Style', val: submission.criteriaScores.codeQuality, icon: <Code2 className="w-4 h-4 text-[#FF8A3D]" /> },
                  { name: 'Security & Vulnerability Audit', val: submission.criteriaScores.security, icon: <Shield className="w-4 h-4 text-[#45D483]" /> },
                  { name: 'Unit & Stress Testing', val: submission.criteriaScores.testing, icon: <Terminal className="w-4 h-4 text-[#FF6A1A]" /> },
                  { name: 'Documentation & Architecture', val: submission.criteriaScores.documentation, icon: <FileText className="w-4 h-4 text-[#38BDF8]" /> },
                  { name: 'UI / UX Interaction', val: submission.criteriaScores.uiUx, icon: <Activity className="w-4 h-4 text-[#FFB547]" /> }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5 font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#F5F5F2]">
                        {item.icon}
                        <span>{item.name}</span>
                      </div>
                      <span className="font-bold text-[#FF8A3D]">{item.val} / 100</span>
                    </div>
                    <ProgressBar value={item.val} size="sm" variant={item.val > 90 ? 'success' : item.val > 80 ? 'orange' : 'warning'} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <Card title="Framework & Runtime Environment">
              <div className="space-y-4 font-mono text-xs">
                <div>
                  <span className="text-[#92979D] text-[10px] uppercase block mb-1.5">Detected Frameworks</span>
                  <div className="flex flex-wrap gap-2">
                    {submission.frameworks.map((fw, i) => (
                      <Badge key={i} variant="neutral">{fw}</Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1E2227]">
                  <span className="text-[#92979D] text-[10px] uppercase block mb-1.5">Git Commit Metadata</span>
                  <div className="bg-[#181B1F] p-3 rounded-lg border border-[#292D32] space-y-1 text-xs">
                    <div>Branch: <span className="text-[#FF8A3D]">{submission.branch}</span></div>
                    <div>Commit SHA: <span className="text-[#F5F5F2]">{submission.commitHash}</span></div>
                    <div>Ingested At: <span className="text-[#92979D]">{submission.submittedAt}</span></div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1E2227] flex items-center justify-between">
                  <span className="text-[#92979D]">Direct Actions:</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onNavigate('requirements')}>
                      VIEW TRACE
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onNavigate('runtime')}>
                      SANDBOX TERMINAL
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Structure */}
      {activeTab === 'structure' && (
        <Card title="Repository Directory Map" badge={<Badge variant="neutral">AST CRAWLER</Badge>}>
          <div className="font-mono text-xs bg-[#08090B] p-4 rounded-lg border border-[#292D32] space-y-2">
            {submission.projectStructure.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2 text-[#FF8A3D] font-bold">
                  {item.type === 'dir' ? <Folder className="w-4 h-4 text-[#FF6A1A]" /> : <FileCode className="w-4 h-4 text-[#92979D]" />}
                  <span>{item.name}</span>
                </div>
                {item.children && (
                  <div className="pl-6 space-y-1 border-l border-[#292D32] ml-2">
                    {item.children.map((child: any, cidx: number) => (
                      <div key={cidx} className="space-y-1">
                        <div className="flex items-center gap-2 text-[#F5F5F2]">
                          {child.type === 'dir' ? <Folder className="w-3.5 h-3.5 text-[#FF8A3D]" /> : <FileCode className="w-3.5 h-3.5 text-[#92979D]" />}
                          <span>{child.name}</span>
                        </div>
                        {child.children && (
                          <div className="pl-6 space-y-1 border-l border-[#292D32] ml-2">
                            {child.children.map((grandChild: any, gidx: number) => (
                              <div key={gidx} className="flex items-center justify-between text-[#92979D] text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" />
                                  {grandChild.name}
                                </span>
                                <span>{grandChild.size}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: README */}
      {activeTab === 'readme' && (
        <Card title="README.md File Preview">
          {submission.readmePreview ? (
            <pre className="p-4 bg-[#08090B] border border-[#292D32] rounded-lg font-mono text-xs text-[#F5F5F2] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px]">
              {submission.readmePreview}
            </pre>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-[#92979D] bg-[#08090B] border border-[#292D32] rounded-lg">
              No README file was detected during repository ingestion.
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Dependencies */}
      {activeTab === 'dependencies' && (
        <Card title="Lockfile Packages & Supply Chain Security">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#292D32] text-[#92979D]">
                  <th className="pb-3 uppercase">Package Name</th>
                  <th className="pb-3 uppercase">Installed Version</th>
                  <th className="pb-3 uppercase">Advisory Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2227]">
                {submission.dependencies.map((dep, idx) => (
                  <tr key={idx} className="hover:bg-[#181B1F]">
                    <td className="py-2.5 font-bold text-[#F5F5F2]">{dep.name}</td>
                    <td className="py-2.5 text-[#92979D]">{dep.version}</td>
                    <td className="py-2.5">
                      <Badge variant={dep.auditStatus === 'SECURE' ? 'success' : dep.auditStatus === 'OUTDATED' ? 'warning' : 'danger'}>
                        {dep.auditStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
