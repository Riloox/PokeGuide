import { useEffect, Dispatch, SetStateAction } from 'react';
import { PcMon, TeamMon } from '../models';
import { getPokemon } from '../lib/pokeapi';
import { getMove, getItem, getAbility, getPokemonName } from '../lib/data';
import { TypeBadge } from './TypeBadge';

export default function PcGrid({
  pc,
  team,
  setTeam,
  setPc,
}: {
  pc: PcMon[];
  team: TeamMon[];
  setTeam: Dispatch<SetStateAction<TeamMon[]>>;
  setPc: Dispatch<SetStateAction<PcMon[]>>;
}) {
  useEffect(() => {
    let cancelled = false;
    const enrich = async () => {
      let changed = false;
      await Promise.all(
        pc.map(async (m) => {
          if (!m.sprite || !m.types.length) {
            try {
              const data = await getPokemon(m.species);
              m.sprite = data.sprite;
              m.types = data.types;
              changed = true;
            } catch {
              /* ignore */
            }
          }
          if (m.ability && typeof m.ability === 'number') {
            try {
              const ab = await getAbility(m.ability);
              if (ab) {
                m.ability = ab;
                changed = true;
              }
            } catch {}
          }
          if (m.item && typeof m.item === 'number') {
            try {
              const it = await getItem(m.item);
              if (it) {
                m.item = it;
                changed = true;
              }
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
            changed = true;
          }
          if (!m.speciesName) {
            const num = parseInt(m.species, 10);
            if (!isNaN(num)) {
              try {
                const nm = await getPokemonName(num);
                if (nm) {
                  m.speciesName = nm;
                  changed = true;
                }
              } catch {}
            }
          }
        }),
      );
      if (!cancelled && changed) setPc([...pc]);
    };
    enrich();
    return () => {
      cancelled = true;
    };
  }, [pc]);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2 text-yellow-100">PC</h2>
      <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
        {pc.map((m, i) => (
          <div
            key={i}
            className="border-2 border-yellow-500 p-1 bg-red-900 text-xs text-center"
          >
            {m.sprite && (
              <img
                src={m.sprite}
                alt={m.speciesName || m.species}
                className="w-12 h-12 mx-auto"
              />
            )}
            <div>{m.nick || m.speciesName || m.species}</div>
            {m.level && <div>Nv: {m.level}</div>}
            {m.item && <div>Obj: {m.item}</div>}
            <div className="flex justify-center gap-1 mt-1">
              {m.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <ul>
              {m.moveNames?.map((mv, j) => (
                <li key={j}>{mv}</li>
              ))}
            </ul>
            <button
              className="mt-1 border border-yellow-500 px-1"
              onClick={() => {
                const sp = prompt('Nueva especie', m.species);
                if (sp) {
                  const updated = {
                    ...m,
                    species: sp,
                    speciesName: undefined,
                    sprite: undefined,
                    types: [],
                  };
                  const newPc = [...pc];
                  newPc[i] = updated;
                  setPc(newPc);
                }
              }}
            >
              Corregir
            </button>
            <button
              className="mt-1 border border-yellow-500 px-1"
              onClick={() => {
                if (team.length >= 6) return;
                const newPc = pc.filter((_, idx) => idx !== i);
                setPc(newPc);
                setTeam([...team, m]);
              }}
            >
              Al equipo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
