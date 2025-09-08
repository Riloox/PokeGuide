import { useRef } from 'react';
import { parseShowdown } from '../lib/showdown';
import { parseRxdata } from '../lib/rxdata';
import { TeamMon, PcMon, Trainer } from '../models';

interface Props {
  setTeam: (t: TeamMon[]) => void;
  setPc: (p: PcMon[]) => void;
  setTrainers: (t: Trainer[]) => void;
  log: string[];
  addLog: (m: string) => void;
}

export default function ImportPanel({ setTeam, setPc, setTrainers, log, addLog }: Props) {
  const showdownRef = useRef<HTMLInputElement>(null);
  const rxdataRef = useRef<HTMLInputElement>(null);
  const trainersRef = useRef<HTMLTextAreaElement>(null);

  const handleShowdown = async () => {
    const file = showdownRef.current?.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const team = parseShowdown(text);
      setTeam(team);
      addLog(`Parsed Showdown team with ${team.length} mons.`);
    } catch (e) {
      addLog('Showdown error');
    }
  };

  const handleRxdata = async () => {
    const file = rxdataRef.current?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    try {
      const pc = parseRxdata(buf);
      setPc(pc);
      addLog(`Parsed rxdata with ${pc.length} mons.`);
    } catch (e) {
      addLog('rxdata error');
    }
  };

  const handleTrainers = () => {
    const text = trainersRef.current?.value || '';
    try {
      const arr = JSON.parse(text);
      setTrainers(arr);
      addLog(`Loaded ${arr.length} trainers.`);
    } catch {
      addLog('Trainers JSON error');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl">Import</h2>
      <div>
        <input ref={showdownRef} type="file" accept=".txt" />
        <button className="ml-2 px-2 py-1 bg-gray-700" onClick={handleShowdown}>
          Load
        </button>
      </div>
      <div>
        <input ref={rxdataRef} type="file" accept=".rxdata" />
        <button className="ml-2 px-2 py-1 bg-gray-700" onClick={handleRxdata}>
          Load
        </button>
      </div>
      <div>
        <textarea ref={trainersRef} className="w-full h-24 text-black" placeholder="Trainers JSON" />
        <button className="mt-1 px-2 py-1 bg-gray-700" onClick={handleTrainers}>
          Load Trainers
        </button>
      </div>
      <textarea className="w-full h-24 text-black" readOnly value={log.join('\n')} />
    </div>
  );
}
