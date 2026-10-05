import React, { useEffect, useState } from 'react';
import {
  Send,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  FileText,
  Globe,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { participantApi, hackathonsApi, teamsApi, problemsApi } from '../../services/api';

interface ParticipantSubmissionViewProps {
  initialProblemId?: string;
  initialHackathonId?: string;
  initialTeamId?: string;
  onNavigate: (view: string, params?: any) => void;
}

export const ParticipantSubmissionView: React.FC<ParticipantSubmissionViewProps> = ({
  initialProblemId,
  initialHackathonId,
  initialTeamId,
  onNavigate,
}) => {
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form fields
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>(initialHackathonId || '');
  const [selectedProblemId, setSelectedProblemId] = useState<string>(initialProblemId || '');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || '');
  const [projectName, setProjectName] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [repositoryUrl, setRepositoryUrl] = useState<string>('');
  const [branch, setBranch] = useState<string>('main');
  const [demoUrl, setDemoUrl] = useState<string>('');
  const [docUrl, setDocUrl] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [hRes, pRes, tRes] = await Promise.all([
        hackathonsApi.getAll(),
        problemsApi.getAll(),
        teamsApi.getMyTeams(),
      ]);

      const hList = hRes.hackathons || [];
      const pList = pRes || [];
      const tList = tRes.teams || [];

      setHackathons(hList);
      setProblems(pList);
      setTeams(tList);

      if (!selectedHackathonId && hList.length > 0) setSelectedHackathonId(hList[0].id);
      if (!selectedProblemId && pList.length > 0) setSelectedProblemId(pList[0].id);
      if (!selectedTeamId && tList.length > 0) setSelectedTeamId(tList[0].id);
    } catch (err) {
      console.warn('Failed to load submission form data:', err);
    } finally {
      setLoading(false);
    }
  }

  const validateGitHub = (url: string) => {
    try {
      const parsed = new URL(url);
      return (
        (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com') &&
        parsed.pathname.split('/').filter(Boolean).length >= 2
      );
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!projectName.trim()) {
      setErrorMsg('Please enter a project name');
      return;
    }

    if (!repositoryUrl.trim() || !validateGitHub(repositoryUrl.trim())) {
      setErrorMsg('Please enter a valid GitHub repository URL (e.g. https://github.com/organization/repo)');
      return;
    }

    if (!selectedTeamId) {
      setErrorMsg('Please select a team or form a team first');
      return;
    }

    if (!selectedProblemId) {
      setErrorMsg('Please select a problem statement');
      return;
    }

    setSubmitting(true);
    try {
      const res = await participantApi.createSubmission({
        hackathonId: selectedHackathonId,
        problemId: selectedProblemId,
        teamId: selectedTeamId,
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim() || undefined,
        repositoryUrl: repositoryUrl.trim(),
        branch: branch.trim() || 'main',
        demoUrl: demoUrl.trim() || undefined,
        docUrl: docUrl.trim() || undefined,
      });

      setSubmittedData(res.submission);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // If already submitted in this session, render confirmation card
  if (submittedData) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="p-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-[#0E1013] to-[#08090B] space-y-6 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
              Confirmation Receipt
            </span>
            <h2 className="text-2xl font-black text-white">SUBMISSION RECEIVED</h2>
            <p className="text-xs text-zinc-400">
              Your hackathon solution was successfully submitted and verified by ForgeEval pipeline.
            </p>
          </div>

          {/* Details Table */}
          <div className="p-5 rounded-xl border border-white/[0.08] bg-black/40 text-left font-mono text-xs space-y-3">
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Project:</span>
              <span className="text-white font-bold">{submittedData.projectName}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Team:</span>
              <span className="text-white">{submittedData.teamName}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Submission ID:</span>
              <span className="text-[#FF8A3D]">{submittedData.id}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Repository:</span>
              <a
                href={submittedData.githubUrl || submittedData.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#FF8A3D] hover:underline truncate max-w-xs"
              >
                {(submittedData.githubUrl || submittedData.repositoryUrl || '').replace(/^https?:\/\//, '')}
              </a>
            </div>
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Repository Status:</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Analyzing / Preparing Repository
              </span>
            </div>
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-zinc-500">Submitted:</span>
              <span className="text-zinc-300">
                {new Date(submittedData.submittedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Submission Status:</span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SUBMITTED
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('participant-submission-detail', { id: submittedData.id })}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A1A] to-[#FF8A3D] text-black font-mono font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center space-x-2 shadow-lg shadow-[#FF6A1A]/20"
            >
              <span>View Submission Timeline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('participant-dashboard')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-zinc-300 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-mono text-[#FF8A3D] uppercase tracking-wider mb-1">
          <Send className="w-4 h-4" />
          <span>Final Deliverable</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Submit Project Code</h1>
        <p className="text-xs text-zinc-400">
          Connect your GitHub repository to trigger the automated AI evaluation, SAST security scan, and test suite benchmark.
        </p>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="p-8 rounded-2xl border border-white/[0.08] bg-[#0E1013] space-y-6 shadow-xl">
        {/* Team & Problem Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">Submitting Team *</label>
            {teams.length > 0 ? (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900 text-white">
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs font-mono">
                No active team. <span onClick={() => onNavigate('participant-team')} className="underline cursor-pointer">Create team</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">Target Problem Statement *</label>
            <select
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                  {p.code ? `[${p.code}] ` : ''}{p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Project Name */}
        <div>
          <label className="text-xs font-mono text-zinc-400 block mb-1.5">Project Name *</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. AegisShield Fraud Engine"
            className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-mono text-zinc-400 block mb-1.5">Brief Description / Architecture Summary</label>
          <textarea
            rows={3}
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Summarize the core algorithms, tech stack, and key features implemented..."
            className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors resize-none"
          />
        </div>

        {/* Repository URL & Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">GitHub Repository URL *</label>
            <div className="relative">
              <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/organization/repo"
                className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
              />
            </div>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">Must be an accessible repository.</p>
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
            />
          </div>
        </div>

        {/* Demo & Documentation URLs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">Live Demo URL (Optional)</label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://demo.myapp.com"
                className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1.5">Documentation / Spec URL (Optional)</label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://docs.myapp.com"
                className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6A1A]/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Automated checks begin immediately upon submit.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-[#FF6A1A] to-[#FF8A3D] text-black font-mono font-bold text-xs rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#FF6A1A]/20 flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Submitting & Evaluating...' : 'Submit Project'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
