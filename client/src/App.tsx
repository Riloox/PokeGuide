import { useState } from 'react';
import ImportPanel from './components/ImportPanel';
import TeamView from './components/TeamView';
import PcGrid from './components/PcGrid';
import Guide from './components/Guide';
import { TeamMon, PcMon, Trainer } from './models';

export default function App() {
  const [team, setTeam] = useState<TeamMon[]>([]);
  const [pc, setPc] = useState<PcMon[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (m: string) => setLog((l) => [...l, m]);

  return (
    <div className="min-h-screen">
      <header className="p-4 text-center text-2xl">Nuzlocke Generalizer v1.0</header>
      <ImportPanel
        setTeam={setTeam}
        setPc={setPc}
        setTrainers={setTrainers}
        log={log}
        addLog={addLog}
      />
      <TeamView team={team} />
      <PcGrid pc={pc} />
      <Guide trainers={trainers} team={team} pc={pc} />
    </div>
  );
}
