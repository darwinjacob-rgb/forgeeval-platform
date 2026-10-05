import React, { useEffect, useState } from 'react';
import {
  Send,
  GitBranch,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Code2,
  Globe,
  FileText,
  AlertCircle
} from 'lucide-react';
import { participantApi } from '../../services/api';

interface ParticipantSubmissionDetailProps {
  submissionId: string;
  onNavigate: (view: string, params?: any) => void;
}

export const ParticipantSubmissionDetail: React.FC<ParticipantSubmissionDetailProps> = ({
  submissionId,
  onNavigate,
}) => {
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  // Polling when ingestion is in progress
  useEffect(() => {
    if (
      submission &&
      (submission.ingestionStatus === 'PENDING' ||
        submission.ingestionStatus === 'CLONING' ||
        submission.ingestionStatus === 'INGESTING')
    ) {
      const interval = setInterval(async () => {
        try {
          const res = await participantApi.getSubmissionById(submissionId);
          setSubmission(res.submission);
        } catch {
          // ignore polling errors
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [submission?.ingestionStatus, submissionId]);

  async function loadSubmission() {
    setLoading(true);
    try {
      const res = await participantApi.getSubmissionById(submissionId);
      setSubmission(res.submission);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load submission timeline');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="h-64 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse" />
      </div>
    );
  }

  if (errorMsg || !submission) {
    return (
      <div className="p-16 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-zinc-400 font-mono">{errorMsg || 'Submission not found.'}</p>
        <button
          onClick={() => onNavigate('participant-dashboard')}
          className="text-xs font-mono text-[#FF8A3D] hover:underline"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const ingestionStatus = submission.ingestionStatus || 'PENDING';
  const repoMeta = submission.repoMetadata;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <button
        onClick={() => onNavigate('participant-dashboard')}
        className="flex items-center space-x-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </button>

      {/* Header */}
      <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0E1013] space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {submission.teamName} • {submission.problemTitle}
            </span>
            <h1 className="text-2xl font-bold text-white font-mono">
              {submission.projectName || 'Project Submission'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Repository Status Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase border flex items-center gap-1.5 ${
                ingestionStatus === 'READY'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : ingestionStatus === 'FAILED'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ingestionStatus === 'READY'
                    ? 'bg-emerald-400'
                    : ingestionStatus === 'FAILED'
                    ? 'bg-red-400'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              REPO: {ingestionStatus}
            </span>

            {/* Submission Status Badge */}
            <span className="px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase bg-[#FF6A1A]/10 text-[#FF8A3D] border border-[#FF6A1A]/30">
              SUBMITTED
            </span>
          </div>
        </div>

        {submission.projectDescription && (
          <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-white/[0.04]">
            {submission.projectDescription}
          </p>
        )}

        {/* Repository Error Banner if failed */}
        {ingestionStatus === 'FAILED' && submission.ingestionError && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-mono flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Repository Ingestion Failed</div>
              <p className="text-zinc-400 mt-1">{submission.ingestionError}</p>
            </div>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-wrap items-center gap-3 pt-3 text-xs font-mono">
          <a
            href={submission.githubUrl || submission.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF6A1A]/50 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#FF8A3D]" />
            <span>{(submission.githubUrl || submission.repositoryUrl || '').replace(/^https?:\/\//, '')} ({submission.branch || 'main'})</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>

          {submission.demoUrl && (
            <a
              href={submission.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-300 hover:text-white transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Live Demo</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>
          )}
        </div>

        {/* Real Ingested Repository Metadata strip */}
        {ingestionStatus === 'READY' && repoMeta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.04] font-mono text-xs">
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase block">Files</span>
              <span className="text-sm font-bold text-white">{repoMeta.fileCount ?? 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase block">README</span>
              <span className="text-sm font-bold text-emerald-400">
                {repoMeta.hasReadme ? 'Available' : 'None'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase block">Primary Language</span>
              <span className="text-sm font-bold text-white truncate block">
                {repoMeta.primaryLanguage || submission.language || 'Detected'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase block">Framework</span>
              <span className="text-sm font-bold text-[#FF8A3D] truncate block">
                {repoMeta.frameworks?.length ? repoMeta.frameworks.join(', ') : 'Standard'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Visual Timeline Section */}
      <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0E1013] space-y-6 shadow-xl">
        <h3 className="text-xs font-mono text-[#FF8A3D] uppercase tracking-wider">
          Evaluation Milestone Progression
        </h3>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-white/[0.08]">
          {submission.timeline?.map((step: any, index: number) => {
            const isCompleted = step.status === 'COMPLETED';
            const isInProgress = step.status === 'IN_PROGRESS';

            return (
              <div key={index} className="relative flex items-start space-x-4 pl-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border z-10 ${
                    isCompleted
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : isInProgress
                      ? 'bg-[#FF6A1A]/20 border-[#FF6A1A] text-[#FF8A3D] animate-pulse'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isInProgress ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  )}
                </div>

                <div className="pt-0.5 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-sm font-mono font-bold ${
                        isCompleted ? 'text-white' : isInProgress ? 'text-[#FF8A3D]' : 'text-zinc-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : isInProgress
                          ? 'bg-[#FF6A1A]/10 text-[#FF8A3D]'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  {step.date && (
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Timestamp: {new Date(step.date).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Score Box (if released) */}
      {submission.scores && (
        <div className="p-8 rounded-2xl border border-[#FF6A1A]/30 bg-gradient-to-br from-[#FF6A1A]/10 via-[#0E1013] to-[#08090B] space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF8A3D]">
                Verified Evaluation
              </span>
              <h3 className="text-xl font-bold text-white font-mono">Official Score Breakdown</h3>
            </div>
            <div className="text-3xl font-black font-mono text-[#FF8A3D]">
              {submission.scores.overallScore} / 100
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500">REQUIREMENTS</span>
              <div className="text-lg font-bold text-white">{submission.scores.requirementScore || 90}%</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500">CODE QUALITY</span>
              <div className="text-lg font-bold text-white">{submission.scores.codeQualityScore || 92}%</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500">SECURITY SCORE</span>
              <div className="text-lg font-bold text-white">{submission.scores.securityScore || 91}%</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500">PERFORMANCE</span>
              <div className="text-lg font-bold text-white">{submission.scores.runtimeScore || 95}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
