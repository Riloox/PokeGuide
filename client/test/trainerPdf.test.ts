import { describe, it, expect } from 'vitest';
import { normalizeText } from '../src/lib/trainerPdf';

describe('normalizeText', () => {
  it('strips null bytes and collapses spaces', () => {
    const raw = 'L\u0000íder   Brock';
    expect(normalizeText(raw)).toBe('Líder Brock');
  });
});
