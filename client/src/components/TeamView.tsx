import { useEffect } from 'react';
import { TeamMon } from '../models';
import { getPokemon } from '../lib/pokeapi';

export default function TeamView({ team }: { team: TeamMon[] }) {
  useEffect(() => {
    team.forEach(async (m) => {
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
  }, [team]);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2">Team</h2>
      <div className="grid grid-cols-3 gap-2">
        {team.map((m, i) => (
          <div key={i} className="border p-2 bg-gray-800">
            {m.sprite && <img src={m.sprite} alt={m.species} className="w-16 h-16" />}
            <div>{m.nick || m.species}</div>
            <div className="text-xs">{m.types.join('/')}</div>
            {m.ability && <div className="text-xs">Ability: {m.ability}</div>}
            {m.item && <div className="text-xs">Item: {m.item}</div>}
            <ul className="text-xs list-disc ml-4">
              {m.moves.map((mv, j) => (
                <li key={j}>{mv}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
