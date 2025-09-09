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
  // capture each text item along with its X coordinate so we can drop
  // left-margin notes that aren't part of the roster tables
  const rows: { str: string; x: number }[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter((it) => 'str' in it && it.str.trim())
      .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
      .sort((a, b) => (Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y));
    let lineY: number | null = null;
    let line: { str: string; x: number }[] = [];
    for (const it of items) {
      if (lineY === null || Math.abs(it.y - lineY) > 2) {
        if (line.length) rows.push(line);
        line = [it];
        lineY = it.y;
      } else {
        line.push(it);
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
  const MIN_COL_X = 150; // left edge of roster tables
  for (const raw of rows) {
    const cells = raw.filter((c) => c.x >= MIN_COL_X).map((c) => c.str);
    const first = cells[0] ?? '';

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

    if (skip > 0) {
      skip--;
      continue;
    }

    const isRoster =
      cells.length > 0 && cells.every((c) => /^[A-ZÁÉÍÓÚÜÑ0-9\s-]+$/.test(c));
    if (isRoster) {
      // Start a new roster block (handles multiple possible parties).
      blockStart = current.roster.length;
      blockCols = cells.length;
      blockMoves = 0;
      current.roster.push(...cells.map(normalize));
      for (let i = 0; i < cells.length; i++) current.moves.push([]);
      // Skip the immediate type row that follows the roster names.
      skip = 1;
      continue;
    }

    if (cells.some((c) => c.includes(':'))) continue;
    if (!cells.some((c) => c.trim())) continue;
    if (blockCols === 0) continue;

    const valid = cells.slice(0, blockCols).filter((c) => c && c !== '---');
    if (valid.length === 0 || (blockCols > 1 && valid.length === 1 && blockMoves)) {
      blockCols = 0;
      continue;
    }
    for (let i = 0; i < blockCols; i++) {
      const mv = cells[i];
      if (mv && mv !== '---') current.moves[blockStart + i].push(mv);
    }
    blockMoves++;
  }
  if (current) trainers.push(current);
  return trainers;
}
