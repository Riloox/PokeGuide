import { useEffect, Dispatch, SetStateAction } from 'react';
import { TeamMon, PcMon } from '../models';
import { getPokemon } from '../lib/pokeapi';
import { getMove, getItem, getAbility, getPokemonName } from '../lib/data';
import { TypeBadge } from './TypeBadge';

export default function TeamView({
  team,
  setTeam,
  setPc,
}: {
  team: TeamMon[];
  setTeam: Dispatch<SetStateAction<TeamMon[]>>;
  setPc: Dispatch<SetStateAction<PcMon[]>>;
}) {
  useEffect(() => {
    let cancelled = false;
    const enrich = async () => {
      await Promise.all(
        team.map(async (m) => {
          if (!m.sprite || !m.types.length) {
            try {
              const data = await getPokemon(m.species);
              m.sprite = data.sprite;
              m.types = data.types;
            } catch {
              /* ignore */
            }
          }
          if (m.ability && typeof m.ability === 'number') {
            try {
              const ab = await getAbility(m.ability);
              if (ab) m.ability = ab;
            } catch {}
          }
          if (m.item && typeof m.item === 'number') {
            try {
              const it = await getItem(m.item);
              if (it) m.item = it;
            } catch {}
          }
          if (!m.moveNames || m.moveNames.length === 0) {
            m.moveNames = [];
            for (const id of m.moves) {
              try {
                const mv = await getMove(id);
                m.moveNames.push(mv?.name || String(id));
              } catch {
                m.moveNames.push(String(id));
              }
            }
          }
          if (!m.speciesName) {
            const num = parseInt(m.species, 10);
            if (!isNaN(num)) {
              try {
                const nm = await getPokemonName(num);
                if (nm) m.speciesName = nm;
              } catch {}
            }
          }
        }),
      );
      if (!cancelled) setTeam([...team]);
    };
    enrich();
    return () => {
      cancelled = true;
    };
  }, [team, setTeam]);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2 text-yellow-100">Equipo</h2>
      <div className="grid grid-cols-3 gap-2">
        {team.map((m, i) => (
          <div
            key={i}
            className="border-2 border-yellow-500 p-2 bg-red-900 text-center"
          >
            {m.sprite && (
              <img
                src={m.sprite}
                alt={m.speciesName || m.species}
                className="w-16 h-16 mx-auto"
              />
            )}
            <div className="text-sm mt-1">{m.nick || m.speciesName || m.species}</div>
            <div className="flex justify-center gap-1 text-xs mt-1">
              {m.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {m.level && <div className="text-xs">Nv: {m.level}</div>}
            {m.ability && (
              <div className="text-xs">Habilidad: {m.ability}</div>
            )}
            {m.item && <div className="text-xs">Objeto: {m.item}</div>}
            <ul className="text-xs list-disc ml-4 text-left">
              {m.moveNames?.map((mv, j) => (
                <li key={j}>{mv}</li>
              ))}
            </ul>
            <button
              className="mt-1 text-xs border border-yellow-500 px-1"
              onClick={() => {
                const newTeam = team.filter((_, idx) => idx !== i);
                setTeam(newTeam);
                setPc((pc) => [...pc, m]);
              }}
            >
              Al PC
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
