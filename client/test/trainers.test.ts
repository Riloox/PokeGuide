import { describe, it, expect } from 'vitest';
import trainers from '../../trainers.json';

describe('default trainers', () => {
  it('loads trainer list', () => {
    expect(Array.isArray(trainers)).toBe(true);
    expect(trainers.length).toBeGreaterThan(0);
    const names = trainers.map((t: any) => t.trainer || t.title || '');
    expect(names.some((n: string) => /brock/i.test(n))).toBe(false);
    expect(names.some((n: string) => /joey/i.test(n))).toBe(false);
  });
});
