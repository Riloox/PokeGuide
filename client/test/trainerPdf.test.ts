import { describe, it, expect } from 'vitest';
import { parseTrainerText } from '../src/lib/trainerPdf';

describe('parseTrainerText', () => {
  it('parses trainer block into roster and moves', () => {
    const text = `Lider\nPikachu - Thunderbolt, Quick Attack\nCharmander - Flamethrower`;
    const trainers = parseTrainerText(text);
    expect(trainers).toHaveLength(1);
    expect(trainers[0]).toEqual({
      title: 'Lider',
      double: false,
      roster: ['pikachu', 'charmander'],
      moves: [
        ['Thunderbolt', 'Quick Attack'],
        ['Flamethrower'],
      ],
    });
  });
});

