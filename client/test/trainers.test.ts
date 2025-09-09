import { describe, it, expect } from 'vitest';
import trainers from '../src/data/trainers.json';

describe('default trainers', () => {
  it('includes Brock and Joey', () => {
    const titles = trainers.map(t => t.title);
    expect(titles).toContain('Líder Brock');
    expect(titles).toContain('Joven Joey');
  });
});
