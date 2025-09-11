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

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2 text-yellow-100">Guía</h2>
      {trainers.map((tr, idx) => (
        <TrainerPanel
          key={idx}
          trainer={tr}
          team={team}
          pc={pc}
          open={open === idx}
          toggle={() => setOpen(open === idx ? null : idx)}
        />
      ))}
    </div>
  );
}

function TrainerPanel({
  trainer,
  team,
  pc,
  open,
  toggle,
}: {
  trainer: Trainer;
  team: TeamMon[];
  pc: PcMon[];
  open: boolean;
  toggle: () => void;
}) {
  const [suggestions, setSuggestions] = useState<
    { mon: PcMon; score: number; types: string[] }[]
  >([]);
  useEffect(() => {
    const typeSet = new Set<string>();
    const compute = async () => {
      for (const moves of trainer.moves) {
        for (const mv of moves) {
          try {
            const data = await getMove(mv);
            if (data) {
              team.forEach((mon) => {
                if (getMultiplier(data.type, mon.types) >= 2) {
                  typeSet.add(data.type);
                }
              });
            }
          } catch {
            // ignore
          }
        }
      }
      const threats = Array.from(typeSet);
      const arr: { mon: PcMon; score: number; types: string[] }[] = [];
      pc.forEach((mon) => {
        const resists: string[] = [];
        threats.forEach((t) => {
          const mult = getMultiplier(t, mon.types);
          if (mult < 1) resists.push(t);
        });
        arr.push({ mon, score: resists.length, types: resists });
      });
      arr.sort((a, b) => b.score - a.score);
      setSuggestions(arr.slice(0, 3));
    };
    compute();
  }, [trainer, team, pc]);

  return (
    <div className="mb-4 border-2 border-yellow-500 p-2 bg-red-900">
      <div className="flex justify-between" onClick={toggle}>
        <div>
          {trainer.title} {trainer.double && <span className="text-xs">Doble</span>}
          {trainer.starting !== undefined && (
            <div className="text-xs mt-1">
              Empieza con {String(trainer.roster[trainer.starting])}
            </div>
          )}
        </div>
        <div>{open ? '-' : '+'}</div>
      </div>
      {open && (
        <>
          <table className="w-full text-xs mt-2">
            <thead>
              <tr>
                <th>Enemigo</th>
                <th>Tipos</th>
                <th>Movimientos</th>
                <th>Amenazas</th>
                <th>Consejos</th>
              </tr>
            </thead>
            <tbody>
              {trainer.roster.map((sp, i) => (
                <TrainerRow
                  key={i}
                  species={sp}
                  moves={trainer.moves[i]}
                  team={team}
                  tip={trainer.tips?.[i]}
                />
              ))}
            </tbody>
          </table>
          {suggestions.length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm">Sugerencias</h3>
              <ul className="list-disc ml-5 text-xs">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    {s.mon.nick || s.mon.speciesName || s.mon.species}: resiste {s.types.map((t) => typeNames[t] || t).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrainerRow({
  species,
  moves,
  team,
  tip,
}: {
  species: string | number;
  moves: number[];
  team: TeamMon[];
  tip?: string[];
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
      <td>
        <ul>
          {tip?.map((t, i) => (
            <li key={i}>{t}</li>
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
