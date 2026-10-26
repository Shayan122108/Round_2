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
  const [currentTeamId, setCurrentTeamId] = useState('REG-103'); // Default to Vector Voyagers (in progress) or REG-101
  const [currentTeam, setCurrentTeam] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(90 * 60);

  // Modals
  const [boilerplateOpen, setBoilerplateOpen] = useState(false);
  const [clueModalOpen, setClueModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Fetch Team & Competition details
  const fetchTeamData = async (teamId) => {
    try {
      const res = await fetch(`/api/team/${teamId || currentTeamId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentTeam(data.team);
        setCompetition(data.competition);

        if (data.competition.endTime && data.competition.status === 'running') {
          const rem = Math.max(0, Math.floor((data.competition.endTime - Date.now()) / 1000));
          setTimeRemaining(rem);
        }
      }
    } catch (err) {
      console.error('Error fetching team info:', err);
    }
  };

  useEffect(() => {
    fetchTeamData(currentTeamId);
  }, [currentTeamId]);

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

  const handleSelectTeam = (id) => {
    setCurrentTeamId(id);
    fetchTeamData(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080d1a] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTeam={currentTeam}
        competition={competition}
        timeRemaining={timeRemaining}
        onOpenTeamModal={() => setTeamModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        
        {/* Deadline Alert Banner if ended */}
        {timeRemaining === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-sm flex items-center justify-between">
            <span className="font-bold">⏰ 90-Minute Round Deadline Reached! Submissions are now closed.</span>
            <span className="badge badge-rose text-xs font-mono">Round Ended</span>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <ContestantDashboard
            currentTeam={currentTeam}
            onRefreshTeam={() => fetchTeamData(currentTeamId)}
            onOpenClueModal={() => setClueModalOpen(true)}
            onOpenBoilerplate={() => setBoilerplateOpen(true)}
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard currentTeamId={currentTeamId} />
        )}

        {activeTab === 'admin' && (
          <AdminPanel />
        )}

      </main>

      {/* Modals */}
      <BoilerplateModal
        isOpen={boilerplateOpen}
        onClose={() => setBoilerplateOpen(false)}
        boilerplateCode={currentTeam?.boilerplate}
        algorithmName={currentTeam?.algorithmName}
      />

      <ClueDatasetModal
        isOpen={clueModalOpen}
        onClose={() => setClueModalOpen(false)}
        teamId={currentTeam?.id}
      />

      <TeamLoginModal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        onSelectTeam={handleSelectTeam}
      />

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[#070b14] py-6 text-center text-xs text-[var(--text-dim)]">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>ML Challenge Platform — 90-Minute Precision Machine Learning Competition</div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>150 Maximum Score</span>
            <span>•</span>
            <span>4 Private Variants</span>
            <span>•</span>
            <span>Isolated Evaluator</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
