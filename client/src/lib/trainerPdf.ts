import { Trainer } from '../models';

const decoder = new TextDecoder();

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

export function parseTrainerText(text: string): Trainer[] {
  const trainers: Trainer[] = [];
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const title = lines[0];
    const roster: (string | number)[] = [];
    const moves: string[][] = [];
    for (const line of lines.slice(1)) {
      const [specPart, movePart] = line.split(/[-:]/, 2);
      if (!specPart) continue;
      roster.push(normalize(specPart.trim()));
      const mvArr = movePart
        ? movePart
            .split(/[,;/]/)
            .map((m) => m.trim())
            .filter(Boolean)
        : [];
      moves.push(mvArr);
    }
    if (roster.length) {
      trainers.push({
        title,
        double: /\b(doble|double)\b/i.test(title),
        roster,
        moves,
      });
    }
  }
  return trainers;
}

export async function parseTrainerPdf(data: ArrayBuffer): Promise<Trainer[]> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const pdf = await pdfjs.getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: any) => ('str' in it ? it.str : ''))
        .join('\n');
      text += pageText + '\n';
    }
    return parseTrainerText(text);
  } catch {
    return parseTrainerText(decoder.decode(new Uint8Array(data)));
  }
}

