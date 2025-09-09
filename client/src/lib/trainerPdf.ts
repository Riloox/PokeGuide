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
  // Track the current block of Pokémon to correctly associate move rows.
  let blockStart = 0;
  let blockCols = 0;
  let blockMoves = 0;
  let skip = 0;
  for (const row of rows) {
    const first = row[0] ?? '';
    if (/^(Rival|L[ií]der|Alto|Campe[oó]n)/i.test(first)) {
      if (current) trainers.push({ ...current });
      current = { title: first, roster: [], moves: [] };
      blockStart = 0;
      blockCols = 0;
      blockMoves = 0;
      skip = 0;
      continue;
    }
    if (!current) continue;

    const isRoster =
      row.length > 0 && row.every((c) => /^[A-ZÁÉÍÓÚÜÑ0-9\s-]+$/.test(c));
    if (isRoster) {
      // Start a new roster block (handles multiple possible parties).
      blockStart = current.roster.length;
      blockCols = row.length;
      blockMoves = 0;
      current.roster.push(...row.map(normalize));
      for (let i = 0; i < row.length; i++) current.moves.push([]);
      // Skip the immediate type row that follows the roster names.
      skip = 1;
      continue;
    }

    if (skip > 0) {
      skip--;
      continue;
    }
    if (row.some((c) => c.includes(':'))) continue;
    if (!row.some((c) => c.trim())) continue;
    if (blockCols === 0) continue;

    for (let i = 0; i < blockCols; i++) {
      const mv = row[i];
      if (mv && mv !== '---') current.moves[blockStart + i].push(mv);
    }
    blockMoves++;
    if (blockMoves >= 4) {
      blockCols = 0;
    }
  }
  if (current) trainers.push(current);
  return trainers;
}
