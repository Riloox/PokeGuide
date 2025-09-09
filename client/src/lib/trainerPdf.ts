import type { Trainer } from '../models';
// Use the modern ESM build of pdf.js and explicitly point to the worker.
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';


(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

export async function parseTrainerPdf(data: ArrayBuffer): Promise<Trainer[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const rows: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter((it) => 'str' in it && it.str.trim())
      .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
      .sort((a, b) => (Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y));
    let lineY: number | null = null;
    let line: string[] = [];
    for (const it of items) {
      if (lineY === null || Math.abs(it.y - lineY) > 2) {
        if (line.length) rows.push(line);
        line = [it.str];
        lineY = it.y;
      } else {
        line.push(it.str);
      }
    }
    if (line.length) rows.push(line);
  }
  const trainers: Trainer[] = [];
  let current: { title: string; roster: string[]; moves: string[][] } | null =
    null;
  let skip = 0;
  for (const row of rows) {
    const first = row[0] ?? '';
    if (/^(Rival|L[ií]der|Alto|Campe[oó]n)/i.test(first)) {
      if (current) trainers.push({ ...current });
      current = { title: first, roster: [], moves: [] };
      skip = 0;
      continue;
    }
    if (!current) continue;
    if (
      !current.roster.length &&
      row.length > 1 &&
      row.every((c) => /^[A-ZÁÉÍÓÚÜÑ0-9\s-]+$/.test(c))
    ) {
      current.roster = row.map(normalize);
      current.moves = current.roster.map(() => []);
      skip = 2;
      continue;
    }
    if (skip > 0) {
      skip--;
      continue;
    }
    if (row.some((c) => c.includes(':'))) continue;
    if (!row.some((c) => c.trim())) continue;
    for (let i = 0; i < current.roster.length; i++) {
      const mv = row[i];
      if (mv && mv !== '---') current.moves[i].push(normalize(mv));
    }
  }
  if (current) trainers.push(current);
  return trainers;
}
