import { Trainer } from '../models';

const decoder = new TextDecoder();

const stripNulls = (s: string) => s.replace(/\u0000/g, '');

const normalize = (s: string) =>
  stripNulls(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const decodeText = (data: ArrayBuffer) => {
  const u8 = new Uint8Array(data);
  let text = decoder.decode(u8);
  if (text.includes('\u0000')) {
    text = new TextDecoder('utf-16le').decode(u8);
  }
  return stripNulls(text);
};

// -------------------------- Utilities --------------------------

const TYPE_WORDS = new Set([
  "ACERO","AGUA","BICHO","DRAGÓN","DRAGON","ELÉCTRICO","ELECTRICO","FANTASMA","FUEGO","HADA",
  "HIELO","LUCHA","NORMAL","PLANTA","PSÍQUICO","PSIQUICO","ROCA","SINIESTRO","TIERRA","VENENO","VOLADOR"
]);

const POTION_WORDS = new Set([
  "POCIÓN","PÓCION","SUPERPOCIÓN","HIPERPOCIÓN","MÁX. POCIÓN","RESTAU. TODO","RESTAURAR TODO",
  "MAXIMAPOCIÓN","MAXIMAPOCION","MAXIMAPOCIÓN"
]);

const SERVICE_LINES = [
  /^OBJ\b/i, /^HAB\b/i, /^Nivel\b/i, /^Niveles\b/i, /^Obj\b/i, /^Hab\b/i
];

const TITLE_MARKERS = [
  /^GIMNASIO\b/i, /^ALTO MANDO\b/i, /^CAMPE(Ó|O)N\b/i,
  /^Rival\b/i, /^Jefe\b/i, /^Comandante\b/i, /^L[ií]der(es)?\b/i,
  /^Maestro\b/i, /^Profesor\b/i, /^Inform[aá]tico\b/i, /^Post-?Game\b/i, /^POST-?GAME\b/i
];

const DOUBLE_MARKERS = [
  /\b(Doble|Combate Doble)\b/i
];

// Normalize raw text extracted from PDFs.
const CLEAN = (s: string) =>
  s
    .replace(/\u0000/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeText = CLEAN;

const isUpperish = (s: string) => {
  const t = s.replace(/[^A-ZÁÉÍÓÚÜÑ\- ]/g, "");
  return t.length >= Math.max(3, Math.floor(s.length * 0.6));
};

const looksLikeSpeciesCell = (s: string) => {
  const t = CLEAN(s).replace(/^MEGA\s+/, "");
  return isUpperish(t) && !TYPE_WORDS.has(t) && !/^(OBJ|HAB|Nivel|Obj|Hab)\b/i.test(t);
};

const asInt = (s: string | undefined) => {
  if (!s) return undefined;
  const m = String(s).match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : undefined;
};

const normMove = (s: string) => CLEAN(s).toLowerCase();
const normSpecies = (s: string) => CLEAN(s).replace(/\s+/g, " ").trim();

// -------------------------- PDF.js adapter --------------------------

async function readPdfTextItems(data: ArrayBuffer | Uint8Array) {
  let pdfjs: any;
  try {
    pdfjs = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf.mjs");
    try {
      const workerSrc = (
        await import(
          /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.mjs?url"
        )
      ).default;
      if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    } catch {
      /* ignore if worker not found */
    }
  } catch (e) {
    throw new Error("pdfjs-dist not found. Install it or use parseText() fallback.");
  }

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: any[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items || []).map((it: any) => {
      const t = it.transform;
      const x = t ? t[4] : 0;
      const y = t ? t[5] : 0;
      return { str: String(it.str || ""), x, y, width: it.width ?? 0 };
    });
    pages.push({ page: p, items });
  }
  return pages;
}

// … keep rest of parsing code, assembleResult, extractMonsFromBlock, etc …

// -------------------------- Public API --------------------------

export async function parsePdf(data: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  const pages = await readPdfTextItems(data);
  const allLines: { y:number;text:string;items:any[] }[] = [];
  for (const pg of pages) {
    const lines = itemsToLines(pg.items);
    allLines.push(...lines.filter(l => l.text));
  }
  const blocks = splitByBattlesFromLines(allLines);
  const res = assembleResult(blocks);
  (res as any).debug = { pages: pages.length, lines: allLines.length, blocks: blocks.length };
  return res;
}

export async function parseTrainerPdf(
  data: ArrayBuffer | Uint8Array,
): Promise<Trainer[]> {
  const res = await parsePdf(data);
  return res.trainers;
}

export function parseText(txt: string): ParseResult {
  const lines = CLEAN(txt).split(/\n+/).map(L => ({ y: 0, text: L, items: [] as any[] }));
  const blocks = splitByBattlesFromLines(lines);
  for (const b of blocks) {
    const idx = b.lines.findIndex(l => /\bNivel\b/i.test(l.text));
    const head = b.lines.slice(0, idx >= 0 ? idx : Math.min(4, b.lines.length)).map(l => l.text).join(" ");
    const allTokens = head.split(/\s{2,}|\s(?=[A-ZÁÉÍÓÚÜÑ]{2,}\b)/).map(CLEAN).filter(Boolean);
    const speciesTokens: string[] = [];
    for (const t of allTokens) {
      if (looksLikeSpeciesCell(t) && !TYPE_WORDS.has(t)) speciesTokens.push(t);
    }
    const mons: TrainerMon[] = speciesTokens.map(t => ({ species: normSpecies(t), moves: [] }));
    const tail = b.lines.slice(0, Math.min(12, b.lines.length)).map(l => l.text).join(" ");
    const moveCandidates = tail.split(/\s{1,}/).filter(Boolean);
    const filtered = moveCandidates.filter(m => {
      const T = m.toUpperCase();
      if (POTION_WORDS.has(T)) return false;
      if (TYPE_WORDS.has(T)) return false;
      if (/^(OBJ|HAB|Nivel)\b/i.test(m)) return false;
      return isUpperish(m);
    }).slice(0, mons.length * 4);
    for (let i = 0; i < filtered.length; i++) {
      const mon = mons[i % Math.max(1, mons.length)];
      (mon.moves ||= []).push(filtered[i]);
    }
    b.lines = [];
    (b as any).mons = mons;
  }

  const trainers: Trainer[] = blocks.map(b => ({
    title: b.title,
    double: b.double,
    mons: (b as any).mons || []
  }));
  const warnings: string[] = trainers.filter(t => !t.mons.length).map(t => `No mons parsed for: ${t.title}`);
  return { trainers, warnings };
}

export function toPokeApiId(species: string): string {
  let s = species.toLowerCase().replace(/\s+/g,"-");
  s = s.replace(/^mega-([a-z0-9\-]+)/, "$1-mega");
  s = s.replace(/’/g,"'");
  return s;
}
