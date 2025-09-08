import { useEffect } from 'react';
import { PcMon } from '../models';
import { getPokemon } from '../lib/pokeapi';

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
      <h2 className="text-xl mb-2">PC</h2>
      <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
        {pc.map((m, i) => (
          <div key={i} className="border p-1 bg-gray-800 text-xs">
            {m.sprite && <img src={m.sprite} alt={m.species} className="w-12 h-12" />}
            <div>{m.nick || m.species}</div>
            <div>{m.types.join('/')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
