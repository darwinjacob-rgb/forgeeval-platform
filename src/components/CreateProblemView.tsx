import React, { useState } from 'react';
import {
  ArrowLeft, Cpu, ShieldCheck, Terminal, FileCode2, Layout, BookOpen,
  Sparkles, Loader2, CheckCircle2, Plus, Pencil, Trash2, X, Save,
  ChevronDown, ChevronUp, AlertCircle, Lightbulb
} from 'lucide-react';
import { Card, Button, Input } from './CommonUI';
import { problemsApi } from '../services/api';

// ── Types ─────────────────────────────────────────────
type RequirementCategory =
  | 'FUNCTIONAL' | 'TECHNICAL' | 'SECURITY'
  | 'PERFORMANCE' | 'UI_UX' | 'DOCUMENTATION' | 'INNOVATION';
type RequirementPriority = 'HIGH' | 'MEDIUM' | 'LOW';

interface ExtractedReq {
  id?: string;
  code: string;
  title: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  keywords: string[];
  acceptanceCriteria: string[];
  weight: number;
}

interface CreateProblemViewProps {
  onCancel: () => void;
  onCreate: (prob: any) => void;
  hackathonId?: string;
}

// ── Helpers ───────────────────────────────────────────
const CATEGORY_COLORS: Record<RequirementCategory, string> = {
  FUNCTIONAL:   'border-[#FF6A1A]/60 text-[#FF8A3D]',
  TECHNICAL:    'border-[#38BDF8]/60 text-[#38BDF8]',
  SECURITY:     'border-[#FF5C5C]/60 text-[#FF5C5C]',
  PERFORMANCE:  'border-[#45D483]/60 text-[#45D483]',
  UI_UX:        'border-[#C084FC]/60 text-[#C084FC]',
  DOCUMENTATION:'border-[#FFB547]/60 text-[#FFB547]',
  INNOVATION:   'border-[#67E8F9]/60 text-[#67E8F9]',
};

const PRIORITY_COLORS: Record<RequirementPriority, string> = {
  HIGH:   'bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/40',
  MEDIUM: 'bg-[#FFB547]/15 text-[#FFB547] border border-[#FFB547]/40',
  LOW:    'bg-[#45D483]/15 text-[#45D483] border border-[#45D483]/40',
};

const CATEGORY_ICONS: Record<RequirementCategory, React.ReactNode> = {
  FUNCTIONAL:    <FileCode2 className="w-3.5 h-3.5" />,
  TECHNICAL:     <Cpu className="w-3.5 h-3.5" />,
  SECURITY:      <ShieldCheck className="w-3.5 h-3.5" />,
  PERFORMANCE:   <Terminal className="w-3.5 h-3.5" />,
  UI_UX:         <Layout className="w-3.5 h-3.5" />,
  DOCUMENTATION: <BookOpen className="w-3.5 h-3.5" />,
  INNOVATION:    <Lightbulb className="w-3.5 h-3.5" />,
};

const CATEGORIES: RequirementCategory[] = [
  'FUNCTIONAL', 'TECHNICAL', 'SECURITY', 'PERFORMANCE', 'UI_UX', 'DOCUMENTATION', 'INNOVATION'
];

// ── Inline edit modal ─────────────────────────────────
const EditRequirementModal: React.FC<{
  req: ExtractedReq;
  onSave: (updated: ExtractedReq) => void;
  onClose: () => void;
}> = ({ req, onSave, onClose }) => {
  const [draft, setDraft] = useState<ExtractedReq>({ ...req });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111316] border border-[#292D32] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#292D32]">
          <div>
            <span className="text-xs font-mono text-[#FF8A3D] uppercase tracking-widest">Edit Requirement</span>
            <h3 className="text-base font-bold font-mono text-[#F5F5F2] mt-0.5">{draft.code}</h3>
          </div>
          <button onClick={onClose} className="text-[#92979D] hover:text-[#F5F5F2] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Title *</label>
            <input
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Description</label>
            <textarea
              rows={3}
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] p-3 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Category</label>
              <select
                className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as RequirementCategory })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', '/')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Priority</label>
              <select
                className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as RequirementPriority })}
              >
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">
              Acceptance Criteria (one per line)
            </label>
            <textarea
              rows={3}
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] p-3 text-xs font-mono focus:outline-none focus:border-[#FF6A1A]"
              value={draft.acceptanceCriteria.join('\n')}
              onChange={(e) => setDraft({ ...draft, acceptanceCriteria: e.target.value.split('\n').filter(Boolean) })}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">
              Keywords (comma separated)
            </label>
            <input
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
              value={draft.keywords.join(', ')}
              onChange={(e) => setDraft({ ...draft, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-[#292D32]">
          <Button variant="secondary" size="sm" onClick={onClose}>CANCEL</Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="w-4 h-4" />}
            onClick={() => { onSave(draft); onClose(); }}
            disabled={!draft.title.trim()}
          >
            SAVE CHANGES
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Add requirement modal ─────────────────────────────
const AddRequirementModal: React.FC<{
  onAdd: (req: Omit<ExtractedReq, 'id'>) => void;
  onClose: () => void;
  existingCodes: string[];
}> = ({ onAdd, onClose, existingCodes }) => {
  const [draft, setDraft] = useState<Omit<ExtractedReq, 'id'>>({
    code: '',
    title: '',
    description: '',
    category: 'FUNCTIONAL',
    priority: 'MEDIUM',
    keywords: [],
    acceptanceCriteria: [],
    weight: 1.0,
  });

  const prefixMap: Record<string, string> = {
    FUNCTIONAL: 'F', TECHNICAL: 'T', SECURITY: 'S', PERFORMANCE: 'P',
    UI_UX: 'U', DOCUMENTATION: 'D', INNOVATION: 'I',
  };

  const autoCode = () => {
    const prefix = prefixMap[draft.category] ?? 'R';
    const count = existingCodes.filter((c) => c.startsWith(prefix)).length + 1;
    return `${prefix}-${String(count).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111316] border border-[#292D32] rounded-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-[#292D32]">
          <span className="text-sm font-bold font-mono text-[#F5F5F2] uppercase">Add Requirement Manually</span>
          <button onClick={onClose} className="text-[#92979D] hover:text-[#F5F5F2]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Title *</label>
            <input
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
              placeholder="e.g. User Authentication with JWT"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Description</label>
            <textarea
              rows={2}
              className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] p-3 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Category</label>
              <select
                className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as RequirementCategory })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', '/')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Priority</label>
              <select
                className="w-full bg-[#181B1F] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as RequirementPriority })}
              >
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-[#292D32]">
          <Button variant="secondary" size="sm" onClick={onClose}>CANCEL</Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => { onAdd({ ...draft, code: autoCode() }); onClose(); }}
            disabled={!draft.title.trim()}
          >
            ADD REQUIREMENT
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────
type Step = 'define' | 'analyze' | 'review';

export const CreateProblemView: React.FC<CreateProblemViewProps> = ({ onCancel, onCreate, hackathonId }) => {
  const [step, setStep] = useState<Step>('define');

  // Step 1: Problem definition
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('AI & Agents');
  const [difficulty, setDifficulty] = useState('HARD');
  const [rawStatement, setRawStatement] = useState('');

  // Step 2: Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [createdProblemId, setCreatedProblemId] = useState<string | null>(null);

  // Step 3: Review state
  const [requirements, setRequirements] = useState<ExtractedReq[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingReq, setEditingReq] = useState<ExtractedReq | null>(null);
  const [addingReq, setAddingReq] = useState(false);
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  const toggleExpand = (code: string) => {
    setExpandedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  // ── Step 1 → 2: Create problem + run analysis
  const handleAnalyze = async () => {
    if (!title.trim()) { setAnalyzeError('Problem title is required'); return; }
    if (rawStatement.trim().length < 50) { setAnalyzeError('Problem statement must be at least 50 characters for meaningful extraction'); return; }
    setAnalyzeError(null);
    setAnalyzing(true);

    try {
      // 1. Create problem
      let problemId = createdProblemId;
      if (!problemId) {
        const createRes = await problemsApi.createWithStatement({
          title: title.trim(),
          description: rawStatement.substring(0, 300),
          category,
          difficulty,
          rawStatement: rawStatement.trim(),
          hackathonId,
        });
        problemId = createRes.problem.id;
        setCreatedProblemId(problemId);
      }

      // 2. Analyze
      const analyzeRes = await problemsApi.analyze(problemId!, rawStatement.trim());
      setRequirements(analyzeRes.requirements as ExtractedReq[]);
      setStep('review');
    } catch (err: any) {
      setAnalyzeError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Requirement edits (local + persisted)
  const handleSaveEdit = async (updated: ExtractedReq) => {
    if (updated.id && createdProblemId) {
      try {
        await problemsApi.updateRequirement(createdProblemId, updated.id, {
          title: updated.title,
          description: updated.description,
          category: updated.category,
          priority: updated.priority,
          keywords: updated.keywords,
          acceptanceCriteria: updated.acceptanceCriteria,
        });
      } catch { /* fall through — local update still applied */ }
    }
    setRequirements((prev) => prev.map((r) => (r.code === updated.code ? updated : r)));
  };

  const handleDeleteReq = async (req: ExtractedReq) => {
    if (req.id && createdProblemId) {
      try { await problemsApi.deleteRequirement(createdProblemId, req.id); } catch { /* ignore */ }
    }
    setRequirements((prev) => prev.filter((r) => r.code !== req.code));
  };

  const handleAddReq = async (newReq: Omit<ExtractedReq, 'id'>) => {
    let persisted: ExtractedReq = { ...newReq };
    if (createdProblemId) {
      try {
        const res = await problemsApi.createRequirement(createdProblemId, {
          title: newReq.title,
          description: newReq.description,
          category: newReq.category,
          priority: newReq.priority,
          keywords: newReq.keywords,
          acceptanceCriteria: newReq.acceptanceCriteria,
        });
        persisted = res.requirement as ExtractedReq;
      } catch { /* use local */ }
    }
    setRequirements((prev) => [...prev, persisted]);
  };

  // ── Final confirm
  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Problem is already persisted; just navigate back with a minimal Problem shape
      const mockProblem = {
        id: createdProblemId || `prob-${Date.now()}`,
        code: `FG-${Math.floor(100 + Math.random() * 900)}`,
        title,
        category,
        difficulty,
        submissionsCount: 0,
        requirementsCount: requirements.length,
        status: 'ACTIVE',
        description: rawStatement.substring(0, 200),
        deadline: '',
        inputRequirements: [],
        outputRequirements: [],
        functionalRequirements: requirements.filter((r) => r.category === 'FUNCTIONAL').map((r) => r.title),
        technicalRequirements: requirements.filter((r) => r.category === 'TECHNICAL').map((r) => r.title),
        securityRequirements: requirements.filter((r) => r.category === 'SECURITY').map((r) => r.title),
        performanceRequirements: requirements.filter((r) => r.category === 'PERFORMANCE').map((r) => r.title),
        uiUxRequirements: requirements.filter((r) => r.category === 'UI_UX').map((r) => r.title),
        docRequirements: requirements.filter((r) => r.category === 'DOCUMENTATION').map((r) => r.title),
      };
      onCreate(mockProblem);
    } finally {
      setSaving(false);
    }
  };

  // ── Step indicator ─────────────────────────────────
  const steps = [
    { key: 'define', label: '01 DEFINE', done: step !== 'define' },
    { key: 'analyze', label: '02 ANALYZE', done: step === 'review' },
    { key: 'review', label: '03 REVIEW', done: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#292D32]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onCancel}>Back</Button>
          <div>
            <h1 className="text-xl font-bold font-mono text-[#F5F5F2] uppercase">Configure New Problem Statement</h1>
            <p className="text-xs font-mono text-[#92979D]">
              Define problem → Extract requirements via AI analysis → Review & confirm
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 text-xs font-mono font-bold uppercase ${
              step === s.key ? 'text-[#FF8A3D]' : s.done ? 'text-[#45D483]' : 'text-[#92979D]'
            }`}>
              {s.done ? <CheckCircle2 className="w-4 h-4" /> : (
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                  step === s.key ? 'border-[#FF6A1A] text-[#FF8A3D]' : 'border-[#292D32] text-[#92979D]'
                }`}>{i + 1}</span>
              )}
              {s.label}
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-[#292D32]" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: DEFINE ─────────────────────────── */}
      {step === 'define' && (
        <div className="space-y-5">
          <Card title="1. Problem Identity">
            <div className="space-y-4">
              <Input
                label="Problem Title *"
                placeholder="e.g. Food Delivery Platform with Real-Time Tracking"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Category Track</label>
                  <select
                    className="w-full bg-[#111316] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {['FinTech', 'AI & Agents', 'Distributed Systems', 'Cybersecurity', 'Web3 Infrastructure', 'DevOps & Tooling'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-[#92979D] block mb-1.5">Difficulty</label>
                  <select
                    className="w-full bg-[#111316] text-[#F5F5F2] border border-[#292D32] rounded-[10px] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF6A1A]"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HARD">HARD</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="EASY">EASY</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card title="2. Problem Statement">
            <div className="space-y-3">
              <p className="text-xs text-[#92979D] font-mono">
                Paste the full hackathon problem statement. The system will automatically extract structured, machine-readable requirements.
              </p>
              <div className="bg-[#0D1117] border border-[#1E2227] rounded-xl p-4 mb-3">
                <div className="text-[10px] font-mono text-[#92979D] uppercase mb-2">Example format</div>
                <p className="text-[11px] text-[#92979D] font-mono leading-relaxed">
                  "Build a food delivery application where users can register, browse restaurants, add items to cart, and place orders. The system must support online payments, real-time order tracking, and an admin dashboard. Use React, Node.js, and PostgreSQL. The API must support 1000 concurrent users with p99 latency under 200ms. Implement JWT authentication and input sanitization."
                </p>
              </div>
              <textarea
                rows={10}
                className="w-full bg-[#111316] text-[#F5F5F2] border border-[#292D32] rounded-[10px] p-4 text-sm font-mono focus:outline-none focus:border-[#FF6A1A] resize-none"
                placeholder="Paste your full problem statement here (minimum 50 characters)..."
                value={rawStatement}
                onChange={(e) => setRawStatement(e.target.value)}
              />
              <div className="flex justify-between text-[10px] font-mono text-[#92979D]">
                <span>{rawStatement.trim().length < 50 ? `${50 - rawStatement.trim().length} more characters needed` : '✓ Ready for analysis'}</span>
                <span>{rawStatement.length} chars</span>
              </div>
            </div>
          </Card>

          {analyzeError && (
            <div className="flex items-start gap-3 p-4 bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 rounded-xl">
              <AlertCircle className="w-4 h-4 text-[#FF5C5C] flex-shrink-0 mt-0.5" />
              <span className="text-sm font-mono text-[#FF5C5C]">{analyzeError}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-[#292D32]">
            <Button variant="secondary" size="lg" onClick={onCancel}>DISCARD</Button>
            <Button
              variant="primary"
              size="lg"
              icon={analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              loading={analyzing}
              onClick={handleAnalyze}
              disabled={!title.trim() || rawStatement.trim().length < 50}
            >
              {analyzing ? 'ANALYZING...' : 'EXTRACT REQUIREMENTS'}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW ─────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-5">
          {/* Summary bar */}
          <div className="flex items-center justify-between p-4 bg-[#0D4A1F]/40 border border-[#45D483]/30 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#45D483]" />
              <div>
                <div className="text-sm font-bold font-mono text-[#45D483]">
                  {requirements.length} Requirements Extracted
                </div>
                <div className="text-[11px] font-mono text-[#92979D]">
                  Review, edit, or add before confirming as evaluation source of truth
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setAddingReq(true)}
            >
              ADD MANUALLY
            </Button>
          </div>

          {/* Requirement cards */}
          {requirements.length === 0 ? (
            <div className="text-center py-16 text-[#92979D] font-mono">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No requirements extracted. Add manually or re-analyze.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requirements.map((req) => {
                const isExpanded = expandedReqs.has(req.code);
                return (
                  <div
                    key={req.code}
                    className={`border rounded-xl overflow-hidden transition-all ${CATEGORY_COLORS[req.category]}`}
                    style={{ background: '#111316' }}
                  >
                    {/* Collapsed header */}
                    <div className="flex items-center justify-between p-4 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${CATEGORY_COLORS[req.category]} bg-transparent shrink-0`}>
                          {req.code}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {CATEGORY_ICONS[req.category]}
                          <span className="text-[10px] font-mono text-[#92979D] uppercase">{req.category.replace('_', '/')}</span>
                        </div>
                        <h4 className="text-sm font-bold font-mono text-[#F5F5F2] truncate">{req.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${PRIORITY_COLORS[req.priority]}`}>
                          {req.priority}
                        </span>
                        <button
                          onClick={() => setEditingReq(req)}
                          className="text-[#92979D] hover:text-[#FF8A3D] transition-colors p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteReq(req)}
                          className="text-[#92979D] hover:text-[#FF5C5C] transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleExpand(req.code)}
                          className="text-[#92979D] hover:text-[#F5F5F2] transition-colors p-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[#292D32]">
                        {req.description && (
                          <p className="text-xs text-[#92979D] font-mono leading-relaxed mt-3">{req.description}</p>
                        )}
                        {req.acceptanceCriteria.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono uppercase text-[#92979D] mb-1.5">Acceptance Criteria</div>
                            <ul className="space-y-1">
                              {req.acceptanceCriteria.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-[#92979D]">
                                  <CheckCircle2 className="w-3 h-3 text-[#45D483] shrink-0 mt-0.5" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {req.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {req.keywords.map((k) => (
                              <span key={k} className="text-[10px] font-mono bg-[#181B1F] border border-[#292D32] text-[#92979D] px-2 py-0.5 rounded">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Category summary */}
          <div className="p-4 bg-[#111316] border border-[#292D32] rounded-xl">
            <div className="text-[11px] font-mono uppercase text-[#92979D] mb-3">Extraction Summary</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const count = requirements.filter((r) => r.category === cat).length;
                if (count === 0) return null;
                return (
                  <div key={cat} className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg border bg-[#181B1F] ${CATEGORY_COLORS[cat]}`}>
                    {CATEGORY_ICONS[cat]}
                    <span className="font-bold">{count}</span>
                    <span>{cat.replace('_', '/')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#292D32]">
            <Button variant="ghost" size="sm" onClick={() => setStep('define')}>
              ← RE-ANALYZE
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={onCancel}>DISCARD</Button>
              <Button
                variant="primary"
                size="lg"
                icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                loading={saving}
                onClick={handleConfirm}
                disabled={requirements.length === 0}
              >
                CONFIRM & SAVE PROBLEM
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────── */}
      {editingReq && (
        <EditRequirementModal
          req={editingReq}
          onSave={handleSaveEdit}
          onClose={() => setEditingReq(null)}
        />
      )}
      {addingReq && (
        <AddRequirementModal
          existingCodes={requirements.map((r) => r.code)}
          onAdd={handleAddReq}
          onClose={() => setAddingReq(false)}
        />
      )}
    </div>
  );
};
