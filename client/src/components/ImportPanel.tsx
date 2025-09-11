import { useRef } from 'react';
import { parseRxdata } from '../lib/rxdata';
import { TeamMon, PcMon, Trainer } from '../models';
import rawTrainers from '../../../trainers.json';

// Map move names in the JSON dataset to their numeric IDs from moves.txt
const moveNameToId: Record<string, number> = {};
let movesLoaded = false;
async function loadMoveIds() {
  if (movesLoaded) return;
  const res = await fetch('/moves.txt');
  if (!res.ok) throw new Error('moves');
  const text = await res.text();
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(',');
    const id = parseInt(parts[0], 10);
    const name = parts[2]?.toUpperCase();
    if (!isNaN(id) && name) moveNameToId[name] = id;
  });
  movesLoaded = true;
}

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
      await loadMoveIds();
      const arr: Trainer[] = (rawTrainers as any[])
        .filter((t) => !/brock|joey/i.test(t.trainer || t.title || ''))
        .map((t) => {
          const roster = (t.pokemons || []).map((p: any) =>
            String(p.name || '').toLowerCase(),
          );
          const moves = (t.pokemons || []).map((p: any) =>
            (p.moves || []).map((m: string) => moveNameToId[m.toUpperCase()] || 0).filter(Boolean),
          );
          const tips = (t.pokemons || []).map((p: any) => {
            const arr: string[] = [];
            if (p.item && !/ninguno/i.test(p.item)) arr.push(`Objeto: ${p.item}`);
            if (p.ability && !/ninguno/i.test(p.ability)) arr.push(`Habilidad: ${p.ability}`);
            return arr;
          });
          const anyTips = tips.some((tp: string[]) => tp.length > 0);
          return {
            title: t.trainer || t.title,
            roster,
            moves,
            ...(anyTips ? { tips } : {}),
          } as Trainer;
        });
      setTrainers(arr);
      addLog(`Se cargaron ${arr.length} entrenadores del juego.`);
    } catch {
      addLog('Error en trainers JSON');
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
