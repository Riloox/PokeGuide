import { useRef } from 'react';
import { parseRxdata } from '../lib/rxdata';
import { TeamMon, PcMon, Trainer } from '../models';

interface Props {
  setTeam: (t: TeamMon[]) => void;
  setPc: (p: PcMon[]) => void;
  setTrainers: (t: Trainer[]) => void;
  log: string[];
  addLog: (m: string) => void;
}

export default function ImportPanel({
  setTeam,
  setPc,
  setTrainers,
  log,
  addLog,
}: Props) {
  const rxdataRef = useRef<HTMLInputElement>(null);

  const handleRxdata = async () => {
    const file = rxdataRef.current?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    try {
      const { team, pc } = parseRxdata(buf);
      setTeam(team);
      setPc(pc);
      addLog(`Se cargaron ${team.length} miembros del equipo y ${pc.length} del PC.`);
    } catch (e) {
      addLog('Error al leer rxdata');
    }
  };

  const handleDefaultTrainers = async () => {
    try {
      const res = await fetch('/trainers.json');
      if (!res.ok) throw new Error('fetch');
      const arr: Trainer[] = await res.json();
      setTrainers(arr);
      addLog(`Se cargaron ${arr.length} entrenadores del juego.`);
    } catch {
      addLog('Error al cargar entrenadores');
    }
  };

  return (
    <div className="p-4 space-y-4 border-2 border-yellow-500 bg-red-900 text-yellow-200">
      <h2 className="text-xl mb-2">Importar</h2>
      <div>
        <input ref={rxdataRef} type="file" accept=".rxdata" />
        <button className="ml-2" onClick={handleRxdata}>
          Cargar partida
        </button>
        <div className="text-xs mt-1">
          Selecciona tu archivo <b>.rxdata</b> desde la carpeta "Partidas Guardadas".
        </div>
      </div>
      <div>
        <button onClick={handleDefaultTrainers}>Cargar entrenadores del juego</button>
      </div>
      <textarea
        className="w-full h-24 text-black"
        readOnly
        value={log.join('\n')}
      />
    </div>
  );
}
