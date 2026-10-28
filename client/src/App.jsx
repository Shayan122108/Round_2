import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ContestantDashboard from './components/ContestantDashboard';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import BoilerplateModal from './components/BoilerplateModal';
import ClueDatasetModal from './components/ClueDatasetModal';
import TeamLoginModal from './components/TeamLoginModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authUser, setAuthUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(90 * 60);

  // Modals
  const [boilerplateOpen, setBoilerplateOpen] = useState(false);
  const [clueModalOpen, setClueModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Check auth session
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const body = await res.json();
        setAuthUser(body.data.user);
        setCsrfToken(body.data.csrfToken);
        setCompetition(body.data.competition);
        if (body.data.competition?.remainingSeconds !== undefined) {
          setTimeRemaining(body.data.competition.remainingSeconds);
        }
        if (body.data.user?.role === 'PARTICIPANT') {
          fetchProgress();
        }
      } else {
        setAuthUser(null);
        setTeamModalOpen(true);
      }
    } catch (err) {
      console.error('Error verifying auth session:', err);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const body = await res.json();
        setDashboardData(body.data);
        if (body.data.competition?.remainingSeconds !== undefined) {
          setTimeRemaining(body.data.competition.remainingSeconds);
        }
      }
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Timer Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (loginData) => {
    setAuthUser(loginData.user);
    setCsrfToken(loginData.csrfToken);
    setCompetition(loginData.competition);
    setTeamModalOpen(false);
    if (loginData.user.role === 'ADMIN') {
      setActiveTab('admin');
    } else {
      setActiveTab('dashboard');
      fetchProgress();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setAuthUser(null);
    setDashboardData(null);
    setTeamModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080d1a] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        authUser={authUser}
        competition={competition}
        timeRemaining={timeRemaining}
        onOpenTeamModal={() => setTeamModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {timeRemaining === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-sm flex items-center justify-between">
            <span className="font-bold">⏰ Competition Deadline Reached! Submissions are now closed.</span>
            <span className="badge badge-rose text-xs font-mono">Round Ended</span>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <ContestantDashboard
            authUser={authUser}
            dashboardData={dashboardData}
            csrfToken={csrfToken}
            onRefreshTeam={fetchProgress}
            onOpenClueModal={() => setClueModalOpen(true)}
            onOpenBoilerplate={() => setBoilerplateOpen(true)}
            onOpenLogin={() => setTeamModalOpen(true)}
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard authUser={authUser} />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            authUser={authUser}
            csrfToken={csrfToken}
            onOpenLogin={() => setTeamModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <BoilerplateModal
        isOpen={boilerplateOpen}
        onClose={() => setBoilerplateOpen(false)}
        boilerplateCode={dashboardData?.reveal?.starterTemplate}
        algorithmName={dashboardData?.reveal?.algorithmName}
      />

      <ClueDatasetModal
        isOpen={clueModalOpen}
        onClose={() => setClueModalOpen(false)}
        unlocked={dashboardData?.stages?.anagram?.unlocked}
      />

      <TeamLoginModal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[#070b14] py-6 text-center text-xs text-[var(--text-dim)]">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>ML Challenge Platform — 90-Minute Precision Machine Learning Competition</div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>150 Maximum Score</span>
            <span>•</span>
            <span>Docker-Isolated Scikit-Learn Evaluator</span>
            <span>•</span>
            <span>Authoritative PostgreSQL & BullMQ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
