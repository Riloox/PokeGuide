import type { Trainer } from '../models';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';


(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

export async function parseTrainerPdf(data: ArrayBuffer): Promise<Trainer[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let raw = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    raw +=
      content.items
        .map((it: any) => ('str' in it ? it.str : ''))
        .join(' ') + '\n';
  }
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l);
  const trainers: Trainer[] = [];
  let current: { title: string; roster: string[]; moves: string[][] } | null =
    null;
  for (const line of lines) {
    if (/^(Rival|L[ií]der|Alto|Campe[oó]n)/i.test(line)) {
      if (current) trainers.push({ ...current });
      current = { title: line, roster: [], moves: [] };
      continue;
    }
    if (!current) continue;
    if (!current.roster.length && /^[A-ZÁÉÍÓÚÜÑ0-9\s-]+$/.test(line)) {
      const mons = line.split(/\s+/).filter(Boolean).map(normalize);
      current.roster = mons;
      current.moves = mons.map(() => []);
      continue;
    }
    if (current.roster.length && !/:/.test(line) && /^[A-ZÁÉÍÓÚÜÑ0-9\s-]+$/.test(line)) {
      const tokens = line.split(/\s+/);
      for (let i = 0; i < current.roster.length; i++) {
        const mv = tokens[i];
        if (mv && mv !== '---') current.moves[i].push(normalize(mv));
      }
    }
  }
  if (current) trainers.push(current);
  return trainers;
}
