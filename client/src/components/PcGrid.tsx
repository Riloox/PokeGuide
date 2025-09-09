import { useEffect } from 'react';
import { PcMon } from '../models';
import { getPokemon } from '../lib/pokeapi';
import { TypeBadge } from './TypeBadge';

export default function PcGrid({ pc }: { pc: PcMon[] }) {
  useEffect(() => {
    pc.forEach(async (m) => {
      if (!m.sprite || !m.types.length) {
        try {
          const data = await getPokemon(m.species);
          m.sprite = data.sprite;
          m.types = data.types;
        } catch {
          // ignore
        }
      }
    });
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
                alt={m.species}
                className="w-12 h-12 mx-auto"
              />
            )}
            <div>{m.nick || m.species}</div>
            <div className="flex justify-center gap-1 mt-1">
              {m.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
