import { describe, it, expect } from 'vitest';
import { parseShowdown } from '../src/lib/showdown';

describe('parseShowdown', () => {
  it('parses basic team', () => {
    const txt = `Pika (Pikachu) @ Light Ball\nAbility: Static\nLevel: 30\n- Thunderbolt\n- Quick Attack\n\nCharizard\nAbility: Blaze\n- Flamethrower`;
    const team = parseShowdown(txt);
    expect(team.length).toBe(2);
    expect(team[0]).toMatchObject({
      nick: 'Pika',
      species: 'pikachu',
      item: 'Light Ball',
      ability: 'Static',
      level: 30,
      moves: ['Thunderbolt', 'Quick Attack'],
    });
  });
});
