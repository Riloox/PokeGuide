import { describe, it, expect } from 'vitest';
import trainers from '../../data/trainers.json';

describe('default trainers', () => {
  it('loads trainer list', () => {
    expect(Array.isArray(trainers)).toBe(true);
    expect(trainers.length).toBeGreaterThan(0);
  });
});
