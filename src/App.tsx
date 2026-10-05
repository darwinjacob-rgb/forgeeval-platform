import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { ProblemsView } from './components/ProblemsView';
import { CreateProblemView } from './components/CreateProblemView';
import { SubmissionManagement } from './components/SubmissionManagement';
import { SubmissionDetail } from './components/SubmissionDetail';
import { AIAnalysisView } from './components/AIAnalysisView';
import { RequirementMappingView } from './components/RequirementMappingView';
import { CodeIntelligenceView } from './components/CodeIntelligenceView';
import { SecurityAnalysisView } from './components/SecurityAnalysisView';
import { RuntimeTestingView } from './components/RuntimeTestingView';
import { FindingsCenter } from './components/FindingsCenter';
import { JudgeWorkspace } from './components/JudgeWorkspace';
import { ResultsView } from './components/ResultsView';
import { LeaderboardView } from './components/LeaderboardView';
import { SettingsView, ProfileView } from './components/SettingsView';

// Participant Portal Views
import { ParticipantShell } from './components/participant/ParticipantShell';
import { ParticipantDashboard } from './components/participant/ParticipantDashboard';
import { ParticipantHackathons } from './components/participant/ParticipantHackathons';
import { ParticipantHackathonDetail } from './components/participant/ParticipantHackathonDetail';
import { ParticipantProblemDetail } from './components/participant/ParticipantProblemDetail';
import { ParticipantTeamView } from './components/participant/ParticipantTeamView';
import { ParticipantSubmissionView } from './components/participant/ParticipantSubmissionView';
import { ParticipantSubmissionDetail } from './components/participant/ParticipantSubmissionDetail';
import { ParticipantResultsView } from './components/participant/ParticipantResultsView';
import { ParticipantProfileView } from './components/participant/ParticipantProfileView';

import { INITIAL_PROBLEMS, INITIAL_SUBMISSIONS, INITIAL_REQUIREMENTS, INITIAL_FINDINGS } from './mockData';
import { Problem, Submission, Finding, RequirementItem, JudgeEvaluation } from './types';
import { problemsApi, submissionsApi, authApi } from './services/api';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<string>('landing');
  const [navParams, setNavParams] = useState<any>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>({
    name: 'Elena Rostova',
    email: 'dev@forgeeval.com',
    role: 'PARTICIPANT',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  });

  // Core Data States (Admin / V1)
  const [problems, setProblems] = useState<Problem[]>(INITIAL_PROBLEMS);
  const [submissions, setSubmissions] = useState<Submission[]>(INITIAL_SUBMISSIONS);
  const [requirements, setRequirements] = useState<RequirementItem[]>(INITIAL_REQUIREMENTS);
  const [findings, setFindings] = useState<Finding[]>(INITIAL_FINDINGS);

  // Active selection
  const [selectedSubId, setSelectedSubId] = useState<string>('sub-101');
  const [selectedProbId, setSelectedProbId] = useState<string>('prob-01');

  // Load backend data and check auth session on mount
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [meRes, fetchedProblems, fetchedSubmissions] = await Promise.all([
          authApi.getMe().catch(() => null),
          problemsApi.getAll().catch(() => INITIAL_PROBLEMS),
          submissionsApi.getAll().catch(() => INITIAL_SUBMISSIONS),
        ]);

        if (meRes && meRes.user) {
          setCurrentUser(meRes.user);
          setIsAuthenticated(true);
        }

        if (fetchedProblems && fetchedProblems.length > 0) {
          setProblems(fetchedProblems);
        }
        if (fetchedSubmissions && fetchedSubmissions.length > 0) {
          setSubmissions(fetchedSubmissions);
        }
      } catch (err) {
        console.log('Using initial mock dataset');
      }
    }
    loadBackendData();
  }, []);

  const activeSubmission = submissions.find((s) => s.id === selectedSubId) || submissions[0];
  const activeProblem = problems.find((p) => p.id === (activeSubmission?.problemId || selectedProbId)) || problems[0];

  // Navigation Helper
  const handleNavigate = (view: string, params: any = {}) => {
    setNavParams(params);
    setCurrentView(view);
  };

  // Actions
  const handleSelectSubmission = (id: string) => {
    setSelectedSubId(id);
  };

  const handleCreateProblem = (newProb: Problem) => {
    setProblems((prev) => [newProb, ...prev]);
    setCurrentView('problems');
  };

  const handleSaveEvaluation = (evaluation: JudgeEvaluation) => {
    setSubmissions((prev) =>
      prev.map((s) => {
        if (s.id === evaluation.submissionId) {
          return {
            ...s,
            criteriaScores: {
              requirement: evaluation.scores.requirementCompliance,
              codeQuality: evaluation.scores.codeQuality,
              security: evaluation.scores.security,
              testing: evaluation.scores.testing,
              documentation: evaluation.scores.documentation,
              uiUx: evaluation.scores.uiUx,
            },
            status: 'ANALYZED',
          };
        }
        return s;
      })
    );
  };

  const handleTriggerAnalyze = (probId: string) => {
    setSelectedProbId(probId);
    setCurrentView('analysis');
  };

  // 1. Landing Page
  if (currentView === 'landing') {
    return (
      <LandingPage
        onNavigate={(view) => handleNavigate(view)}
        onOpenAnalysis={(subId) => {
          if (subId) setSelectedSubId(subId);
          handleNavigate('analysis');
        }}
      />
    );
  }

  // 2. Authentication
  if (currentView === 'login' || currentView === 'register') {
    return (
      <AuthScreen
        mode={currentView}
        onNavigate={(view) => handleNavigate(view)}
        onSuccess={(user) => {
          setIsAuthenticated(true);
          if (user) setCurrentUser(user);
          if (user?.role === 'PARTICIPANT') {
            handleNavigate('participant-dashboard');
          } else if (user?.role === 'JUDGE') {
            handleNavigate('judge-workspace');
          } else if (user?.role === 'ADMIN' || user?.role === 'ORGANIZER') {
            handleNavigate('dashboard');
          } else {
            handleNavigate('dashboard');
          }
        }}
      />
    );
  }

  // 3. Participant Portal Views
  if (currentView.startsWith('participant-')) {
    return (
      <ParticipantShell
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={() => {
          authApi.logout().catch(() => {});
          setIsAuthenticated(false);
          handleNavigate('landing');
        }}
        currentUser={currentUser}
      >
        {currentView === 'participant-dashboard' && (
          <ParticipantDashboard onNavigate={handleNavigate} currentUser={currentUser} />
        )}

        {currentView === 'participant-hackathons' && (
          <ParticipantHackathons onNavigate={handleNavigate} />
        )}

        {currentView === 'participant-hackathon-detail' && (
          <ParticipantHackathonDetail
            hackathonId={navParams?.id}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'participant-problem-detail' && (
          <ParticipantProblemDetail
            problemId={navParams?.id}
            hackathonId={navParams?.hackathonId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'participant-team' && (
          <ParticipantTeamView onNavigate={handleNavigate} />
        )}

        {currentView === 'participant-submission' && (
          <ParticipantSubmissionView
            initialProblemId={navParams?.problemId}
            initialHackathonId={navParams?.hackathonId}
            initialTeamId={navParams?.teamId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'participant-submission-detail' && (
          <ParticipantSubmissionDetail
            submissionId={navParams?.id}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'participant-results' && (
          <ParticipantResultsView onNavigate={handleNavigate} />
        )}

        {currentView === 'participant-profile' && (
          <ParticipantProfileView onNavigate={handleNavigate} />
        )}
      </ParticipantShell>
    );
  }

  // 4. Admin & Judge Views (AppShell) - V1 PRESERVED 100%
  return (
    <AppShell
      currentView={currentView}
      onNavigate={(view) => handleNavigate(view)}
      onLogout={() => {
        authApi.logout().catch(() => {});
        setIsAuthenticated(false);
        handleNavigate('landing');
      }}
      activeSubmissionName={activeSubmission.team}
    >
      {currentView === 'dashboard' && (
        <DashboardView
          problems={problems}
          submissions={submissions}
          findings={findings}
          onSelectSubmission={handleSelectSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'problems' && (
        <ProblemsView
          problems={problems}
          onSelectProblem={(prob) => setSelectedProbId(prob.id)}
          onNavigate={(view) => handleNavigate(view)}
          onTriggerAnalyze={handleTriggerAnalyze}
        />
      )}

      {currentView === 'create-problem' && (
        <CreateProblemView
          onCancel={() => handleNavigate('problems')}
          onCreate={handleCreateProblem}
        />
      )}

      {currentView === 'submissions' && (
        <SubmissionManagement
          submissions={submissions}
          problems={problems}
          onSelectSubmission={handleSelectSubmission}
          onNavigate={(view) => handleNavigate(view)}
          onRunBatchAnalysis={() => handleNavigate('analysis')}
        />
      )}

      {currentView === 'submission-detail' && (
        <SubmissionDetail
          submission={activeSubmission}
          problem={activeProblem}
          onNavigate={(view) => handleNavigate(view)}
          onRunAnalysis={(id) => {
            setSelectedSubId(id);
            handleNavigate('analysis');
          }}
        />
      )}

      {currentView === 'analysis' && (
        <AIAnalysisView
          submission={activeSubmission}
          requirements={requirements}
          findings={findings}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'requirements' && (
        <RequirementMappingView
          requirements={requirements}
          submission={activeSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'code-intel' && (
        <CodeIntelligenceView
          submission={activeSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'security' && (
        <SecurityAnalysisView
          findings={findings}
          submission={activeSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'runtime' && (
        <RuntimeTestingView
          submission={activeSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'findings' && (
        <FindingsCenter
          findings={findings}
          submissions={submissions}
          problems={problems}
          onSelectSubmission={handleSelectSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'judge-workspace' && (
        <JudgeWorkspace
          submission={activeSubmission}
          requirements={requirements}
          onSaveEvaluation={handleSaveEvaluation}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'results' && (
        <ResultsView
          submissions={submissions}
          problems={problems}
          onSelectSubmission={handleSelectSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'leaderboard' && (
        <LeaderboardView
          submissions={submissions}
          problems={problems}
          onSelectSubmission={handleSelectSubmission}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView onNavigate={(view) => handleNavigate(view)} />
      )}

      {currentView === 'profile' && (
        <ProfileView onNavigate={(view) => handleNavigate(view)} />
      )}
    </AppShell>
  );
}
