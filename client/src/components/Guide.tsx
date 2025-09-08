import { useEffect, useState } from 'react';
import { Trainer, TeamMon, PcMon } from '../models';
import { getPokemon, getMove, getMultiplier } from '../lib/pokeapi';
import { TypeBadge } from './TypeBadge';

interface Props {
  trainers: Trainer[];
  team: TeamMon[];
  pc: PcMon[];
}

export default function Guide({ trainers, team, pc }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [threatTypes, setThreatTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const set = new Set<string>();
    const compute = async () => {
      for (const tr of trainers) {
        for (const moves of tr.moves) {
          for (const mv of moves) {
            try {
              const { type } = await getMove(mv);
              team.forEach((mon) => {
                const mult = getMultiplier(type, mon.types);
                if (mult >= 2) set.add(type);
              });
            } catch {
              // ignore
            }
          }
        }
      }
      setThreatTypes(set);
    };
    compute();
  }, [trainers, team]);

  const suggest = () => {
    const suggestions: { mon: PcMon; score: number; types: string[] }[] = [];
    const threats = Array.from(threatTypes);
    pc.forEach((mon) => {
      const resists: string[] = [];
      threats.forEach((t) => {
        const mult = getMultiplier(t, mon.types);
        if (mult < 1) resists.push(t);
      });
      suggestions.push({ mon, score: resists.length, types: resists });
    });
    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, 3);
  };

  const suggestions = suggest();

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2">Guide</h2>
      {trainers.map((tr, idx) => (
        <div key={idx} className="mb-4 border-2 border-white p-2 bg-gray-800">
          <div className="flex justify-between" onClick={() => setOpen(open === idx ? null : idx)}>
            <div>
              {tr.title} {tr.double && <span className="text-xs">Double</span>}
            </div>
            <div>{open === idx ? '-' : '+'}</div>
          </div>
          {open === idx && (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr>
                  <th>Rival</th>
                  <th>Types</th>
                  <th>Moves</th>
                  <th>Threats</th>
                </tr>
              </thead>
              <tbody>
                {tr.roster.map((sp, i) => (
                  <TrainerRow key={i} species={sp} moves={tr.moves[i]} team={team} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg">Suggestions</h3>
          <ul className="list-disc ml-5 text-sm">
            {suggestions.map((s, i) => (
              <li key={i}>
                {s.mon.nick || s.mon.species}: resists {s.types.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrainerRow({ species, moves, team }: { species: string | number; moves: string[]; team: TeamMon[] }) {
  const [types, setTypes] = useState<string[]>([]);
  const [sprite, setSprite] = useState<string>('');

  useEffect(() => {
    getPokemon(String(species)).then((d) =
