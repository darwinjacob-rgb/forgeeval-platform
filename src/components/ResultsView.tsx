import React, { useState } from 'react';
import { 
  BarChart3, 
  Award, 
  CheckCircle2, 
  ExternalLink, 
  FileText, 
  Filter, 
  FolderGit2, 
  Search,
  Eye,
  Info,
  Send
} from 'lucide-react';
import { Submission, Problem } from '../types';
import { Card, Badge, Button, Input, ProgressBar } from './CommonUI';
import { submissionsApi } from '../services/api';

interface ResultsViewProps {
  submissions: Submission[];
  problems: Problem[];
  onSelectSubmission: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  submissions,
  problems,
  onSelectSubmission,
  onNavigate
}) => {
  const [selectedProblem, setSelectedProblem] = useState<string>('ALL');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [releasedMap, setReleasedMap] = useState<Record<string, boolean>>({});

  const filtered = selectedProblem === 'ALL'
    ? submissions
    : submissions.filter(s => s.problemId === selectedProblem);

  const isSubReleased = (sub: Submission) => {
    if (releasedMap[sub.id] !== undefined) return releasedMap[sub.id];
    return Boolean(sub.isReleased);
  };

  const handleTogglePublish = async (sub: Submission) => {
    const current = isSubReleased(sub);
    const nextState = !current;
    setPublishingId(sub.id);
    try {
      await submissionsApi.releaseSubmission(sub.id, nextState);
      setReleasedMap(prev => ({ ...prev, [sub.id]: nextState }));
    } catch (err: any) {
      alert(err.message || 'Failed to update result publish status');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF6A1A]" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF8A3D]">DELIBERATION AGGREGATE</span>
          </div>
          <h1 className="text-2xl font-bold font-mono text-[#F5F5F2] uppercase">
            Multi-Dimensional Results Matrix
          </h1>
          <p className="text-xs font-mono text-[#92979D]">
            Empirical evaluation data across criteria dimensions. Final awards remain strictly with the judicial panel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="orange">
            {filtered.filter(isSubReleased).length} / {filtered.length} PUBLISHED
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('leaderboard')}>
            VIEW LEADERBOARD
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate('judge-workspace')}>
            OPEN JUDGE DESK
          </Button>
        </div>
      </div>

      {/* Discretion Notice Banner */}
      <div className="p-4 rounded-xl bg-[#181B1F] border border-[#292D32] flex items-center gap-3 text-xs font-mono text-[#92979D]">
        <Info className="w-4 h-4 text-[#FF8A3D] shrink-0" />
        <span>
          <strong>POLICY PROTOCOL:</strong> ForgeEval generates auditable evidence and dimension scores. It intentionally does not crown an automated winner to ensure human discretion, edge innovations, and ethical design nuances are deliberated by judges.
        </span>
      </div>

      {/* Filter by problem */}
      <div className="flex items-center gap-3 bg-[#111316] p-3 rounded-xl border border-[#292D32] font-mono text-xs">
        <span className="text-[#92979D] uppercase">Filter Track:</span>
        <select
          value={selectedProblem}
          onChange={(e) => setSelectedProblem(e.target.value)}
          className="bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF6A1A]"
        >
          <option value="ALL">All Problems ({submissions.length} Submissions)</option>
          {problems.map(p => (
            <option key={p.id} value={p.id}>{p.code}: {p.title.slice(0, 40)}...</option>
          ))}
        </select>
      </div>

      {/* Submissions Result Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((sub) => (
          <Card key={sub.id} className="hover:border-[#FF6A1A]/40 flex flex-col justify-between">
            <div className="space-y-4 font-mono">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#F5F5F2]">{sub.team}</span>
                    <Badge variant="neutral">{sub.language}</Badge>
                    {isSubReleased(sub) ? (
                      <Badge variant="success">● PUBLISHED</Badge>
                    ) : (
                      <Badge variant="neutral">○ UNPUBLISHED</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[#92979D] mt-1 line-clamp-1">{sub.problemTitle}</div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-[#FF6A1A]">{sub.overallScore.toFixed(1)}</div>
                  <span className="text-[10px] text-[#92979D] uppercase">Aggregated Score</span>
                </div>
              </div>

              {/* 6-Dimension Mini Bar Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#181B1F] rounded-lg border border-[#292D32] text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">Requirements</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.requirement}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.requirement} size="sm" variant="orange" />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">Code Quality</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.codeQuality}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.codeQuality} size="sm" variant="orange" />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">Security Audit</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.security}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.security} size="sm" variant="success" />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">Testing Rigor</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.testing}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.testing} size="sm" variant="orange" />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">Documentation</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.documentation}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.documentation} size="sm" variant="orange" />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#92979D]">UI / UX</span>
                    <span className="text-[#F5F5F2] font-bold">{sub.criteriaScores.uiUx}</span>
                  </div>
                  <ProgressBar value={sub.criteriaScores.uiUx} size="sm" variant="orange" />
                </div>
              </div>

              {/* Evidence Synthesis Summary */}
              <div className="text-xs text-[#92979D] bg-[#08090B] p-2.5 rounded border border-[#1E2227]">
                <span className="text-[#45D483] font-semibold block mb-0.5">Evidence Summary:</span>
                Passing {sub.metrics.testCoverage}% unit tests with {sub.metrics.cyclomaticComplexity} avg complexity.
                {sub.metrics.vulnerabilitiesCount === 0 ? ' Zero CVE vulnerabilities identified.' : ` Found ${sub.metrics.vulnerabilitiesCount} CVE advisories.`}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 mt-4 border-t border-[#1E2227] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelectSubmission(sub.id);
                    onNavigate('submission-detail');
                  }}
                >
                  FULL DOSSIER
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onSelectSubmission(sub.id);
                    onNavigate('requirements');
                  }}
                >
                  REQ TRACE
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isSubReleased(sub) ? "secondary" : "primary"}
                  size="sm"
                  icon={isSubReleased(sub) ? <CheckCircle2 className="w-4 h-4 text-[#45D483]" /> : <Send className="w-4 h-4" />}
                  loading={publishingId === sub.id}
                  onClick={() => handleTogglePublish(sub)}
                  className={!isSubReleased(sub) ? "!bg-[#FF6A1A] hover:!bg-[#FF8A3D] !text-[#08090B] font-bold tracking-wider" : "font-mono text-xs"}
                >
                  {isSubReleased(sub) ? 'PUBLISHED (UNPUBLISH)' : 'PUBLISH RESULT'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onSelectSubmission(sub.id);
                    onNavigate('judge-workspace');
                  }}
                >
                  JUDGE
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
