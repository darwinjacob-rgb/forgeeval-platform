import React, { useState } from 'react';
import { 
  FolderGit2, 
  Search, 
  ExternalLink, 
  Play, 
  GitBranch, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  FileCode,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { Submission, Problem } from '../types';
import { Card, Badge, Button, Input, ProgressBar } from './CommonUI';

interface SubmissionManagementProps {
  submissions: Submission[];
  problems: Problem[];
  onSelectSubmission: (id: string) => void;
  onNavigate: (view: string) => void;
  onRunBatchAnalysis: () => void;
}

export const SubmissionManagement: React.FC<SubmissionManagementProps> = ({
  submissions,
  problems,
  onSelectSubmission,
  onNavigate,
  onRunBatchAnalysis
}) => {
  const [selectedProblem, setSelectedProblem] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filtered = submissions.filter(s => {
    const matchProb = selectedProblem === 'ALL' || s.problemId === selectedProblem;
    const matchStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
    const matchSearch = s.team.toLowerCase().includes(search.toLowerCase()) || 
                        s.repository.toLowerCase().includes(search.toLowerCase()) ||
                        s.language.toLowerCase().includes(search.toLowerCase());
    return matchProb && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF6A1A]" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF8A3D]">REPOSITORY INGESTION INVENTORY</span>
          </div>
          <h1 className="text-2xl font-bold font-mono text-[#F5F5F2] uppercase">
            Submission Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRunBatchAnalysis}
            icon={<Sparkles className="w-4 h-4 text-[#FF6A1A]" />}
          >
            RUN BATCH AI ANALYSIS
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('judge-workspace')}
          >
            JUDGING CONSOLE
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#111316] p-4 rounded-xl border border-[#292D32]">
        <div>
          <label className="text-[10px] font-mono uppercase text-[#92979D] block mb-1">Filter by Problem Track</label>
          <select
            value={selectedProblem}
            onChange={(e) => setSelectedProblem(e.target.value)}
            className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#FF6A1A]"
          >
            <option value="ALL">All Problems ({problems.length})</option>
            {problems.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.title.slice(0, 36)}...</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase text-[#92979D] block mb-1">Analysis Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#FF6A1A]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ANALYZED">Analyzed</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase text-[#92979D] block mb-1">Search Team or Repo</label>
          <Input
            placeholder="Search teams, languages, git URLs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {/* Submissions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#292D32] text-[#92979D]">
                <th className="pb-3 uppercase">Team / Author</th>
                <th className="pb-3 uppercase">Target Track</th>
                <th className="pb-3 uppercase">Repository</th>
                <th className="pb-3 uppercase">Language / Stack</th>
                <th className="pb-3 uppercase">Repo Status</th>
                <th className="pb-3 uppercase">Files</th>
                <th className="pb-3 uppercase">Submitted At</th>
                <th className="pb-3 uppercase">Score</th>
                <th className="pb-3 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2227]">
              {filtered.map((sub) => {
                const ingestionStatus = sub.ingestionStatus || (sub.status === 'ANALYZED' ? 'READY' : 'PENDING');
                const ingestionBadge =
                  ingestionStatus === 'READY' ? <Badge variant="success">READY</Badge> :
                  ingestionStatus === 'CLONING' ? <Badge variant="orange">CLONING</Badge> :
                  ingestionStatus === 'INGESTING' ? <Badge variant="orange">INGESTING</Badge> :
                  ingestionStatus === 'FAILED' ? <Badge variant="danger">FAILED</Badge> :
                  <Badge variant="neutral">PENDING</Badge>;

                return (
                  <tr key={sub.id} className="hover:bg-[#181B1F]/60 transition-colors">
                    {/* Team */}
                    <td className="py-3.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-[#FF6A1A]/20 border border-[#FF6A1A]/40 flex items-center justify-center font-bold text-[#FF8A3D] text-[10px]">
                          {sub.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-[#F5F5F2]">{sub.team}</div>
                          <div className="text-[10px] text-[#92979D]">{sub.commitHash ? sub.commitHash.slice(0, 7) : sub.id.slice(0, 7)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 pr-2 max-w-[160px]">
                      <div className="text-[#F5F5F2] truncate">{sub.problemTitle}</div>
                    </td>

                    {/* Repository */}
                    <td className="py-3.5 pr-2 max-w-[180px]">
                      <a
                        href={sub.githubUrl || sub.repository}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF8A3D] hover:underline flex items-center gap-1 truncate"
                      >
                        <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{(sub.githubUrl || sub.repository).replace(/^https?:\/\/github\.com\//, '')}</span>
                      </a>
                    </td>

                    {/* Language / Stack */}
                    <td className="py-3.5 pr-2">
                      <span className="text-[#92979D] text-xs">
                        {sub.repoMetadata?.primaryLanguage || sub.language}
                      </span>
                    </td>

                    {/* Ingestion Status */}
                    <td className="py-3.5 pr-2">
                      {ingestionBadge}
                    </td>

                    {/* Files / README */}
                    <td className="py-3.5 pr-2 text-[#92979D] text-[11px]">
                      <div>{sub.repoMetadata?.fileCount ? `${sub.repoMetadata.fileCount} files` : '—'}</div>
                      {sub.repoMetadata?.hasReadme && (
                        <div className="text-[9px] text-emerald-400">README: Yes</div>
                      )}
                    </td>

                    {/* Submitted At */}
                    <td className="py-3.5 pr-2 text-[#92979D] text-[11px]">
                      {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Score */}
                    <td className="py-3.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${sub.overallScore > 85 ? 'text-[#45D483]' : sub.overallScore > 70 ? 'text-[#FFB547]' : 'text-[#FF5C5C]'}`}>
                          {sub.overallScore.toFixed(1)}
                        </span>
                        <div className="w-12 hidden sm:block">
                          <ProgressBar value={sub.overallScore} size="sm" variant={sub.overallScore > 80 ? 'success' : 'warning'} />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => {
                            onSelectSubmission(sub.id);
                            onNavigate('submission-detail');
                          }}
                        >
                          DETAIL
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Play className="w-3 h-3" />}
                          onClick={() => {
                            onSelectSubmission(sub.id);
                            onNavigate('analysis');
                          }}
                        >
                          EVAL
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
