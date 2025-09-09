import { describe, it, expect } from 'vitest';
import { parseTrainerText, parseTrainerPdf } from '../src/lib/trainerPdf';

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

describe('parseTrainerPdf', () => {
  it('decodes utf-16 text fallback', async () => {
    const text = `Leader\nPikachu - Thunderbolt`;
    const buf = Buffer.from(text, 'utf16le');
    const trainers = await parseTrainerPdf(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    );
    expect(trainers[0].roster[0]).toBe('pikachu');
    expect(trainers[0].moves[0][0]).toBe('Thunderbolt');
  });
});

