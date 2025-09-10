import { useEffect, useState } from 'react';
import { Trainer, TeamMon, PcMon } from '../models';
import { getPokemon, getMultiplier } from '../lib/pokeapi';
import { getMove } from '../lib/data';
import { TypeBadge, typeNames } from './TypeBadge';

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
              const data = await getMove(mv);
              if (data) {
                team.forEach((mon) => {
                  const mult = getMultiplier(data.type, mon.types);
                  if (mult >= 2) set.add(data.type);
                });
              }
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
      <h2 className="text-xl mb-2 text-yellow-100">Guía</h2>
      {trainers.map((tr, idx) => (
        <div
          key={idx}
          className="mb-4 border-2 border-yellow-500 p-2 bg-red-900"
        >
          <div
            className="flex justify-between"
            onClick={() => setOpen(open === idx ? null : idx)}
          >
            <div>
              {tr.title} {tr.double && <span className="text-xs">Doble</span>}
            </div>
            <div>{open === idx ? '-' : '+'}</div>
          </div>
          {open === idx && (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr>
                  <th>Enemigo</th>
                  <th>Tipos</th>
                  <th>Movimientos</th>
                  <th>Amenazas</th>
                </tr>
              </thead>
              <tbody>
                {tr.roster.map((sp, i) => (
                  <TrainerRow
                    key={i}
                    species={sp}
                    moves={tr.moves[i]}
                    team={team}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg">Sugerencias</h3>
          <ul className="list-disc ml-5 text-sm">
            {suggestions.map((s, i) => (
              <li key={i}>
                {s.mon.nick || s.mon.speciesName || s.mon.species}: resiste {s.types.map(t=>typeNames[t]||t).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrainerRow({
  species,
  moves,
  team,
}: {
  species: string | number;
  moves: number[];
  team: TeamMon[];
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [sprite, setSprite] = useState<string>('');

  useEffect(() => {
    getPokemon(String(species)).then((d) => {
      setTypes(d.types);
      setSprite(d.sprite);
    });
  }, [species]);

  return (
    <tr className="text-center border-t">
      <td>
        {sprite && (
          <img
            src={sprite}
            alt={String(species)}
            className="w-12 h-12 mx-auto"
          />
        )}
      </td>
      <td>
        <div className="flex justify-center gap-1">
          {types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </td>
      <td>
        <ul>
          {moves.map((mv, idx) => (
            <MoveCell key={idx} move={mv} />
          ))}
        </ul>
      </td>
      <td>
        <ul>
          {moves.map((mv, idx) => (
            <ThreatCell key={idx} move={mv} team={team} />
          ))}
        </ul>
      </td>
    </tr>
  );
}

function MoveCell({ move }: { move: number }) {
  const [data, setData] = useState<{ type: string; name: string } | null>(null);
  useEffect(() => {
    getMove(move)
      .then((m) => setData(m || null))
      .catch(() => setData(null));
  }, [move]);
  return (
    <li>
      {data ? (
        <>
          {data.name} <TypeBadge type={data.type} />
        </>
      ) : (
        move
      )}
    </li>
  );
}

function ThreatCell({ move, team }: { move: number; team: TeamMon[] }) {
  const [type, setType] = useState('');
  useEffect(() => {
    getMove(move)
      .then((m) => setType(m?.type || ''))
      .catch(() => setType(''));
  }, [move]);
  const threats = team.filter(
    (mon) => type && getMultiplier(type, mon.types) >= 2,
  );
  return <li>{threats.map((t) => t.nick || t.speciesName || t.species).join(', ')}</li>;
}
