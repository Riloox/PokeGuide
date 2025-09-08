import { TeamMon } from '../models';

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

export function parseShowdown(text: string): TeamMon[] {
  const blocks = text
    .replace(/\r/g, '')
    .trim()
    .split(/\n\n+/);
  const team: TeamMon[] = [];
  for (const block of blocks) {
    if (team.length >= 6) break;
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];
    const mon: TeamMon = { species: '', moves: [], types: [] };
    const m = first.match(/^(.*?)(?: \(([^\)]+)\))?(?: @ (.*))?$/);
    if (m) {
      if (m[2]) {
        mon.nick = m[1];
        mon.species = normalize(m[2]);
      } else {
        mon.species = normalize(m[1]);
      }
      if (m[3]) mon.item = m[3];
    }
    for (const line of lines.slice(1)) {
      if (line.startsWith('Ability:')) {
        mon.ability = line.split(':')[1].trim();
      } else if (line.startsWith('Level:')) {
        const lvl = parseInt(line.split(':')[1], 10);
        if (!isNaN(lvl)) mon.level = lvl;
      } else if (line.startsWith('-')) {
        mon.moves.push(line.slice(1).trim());
      }
    }
    team.push(mon);
  }
  return team;
}
