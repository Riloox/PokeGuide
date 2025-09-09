// trainerPdf.ts — Parser for 'GUIA MODO COMPLETO' (Pokémon Añil) trainer guide
// Works in browser (pdfjs-dist) or Node (with a bundler).
// Exports:
//   - parsePdf(data)  → uses pdfjs-dist (if present) to read text items with positions, then parses into Trainer[]
//   - parseText(text) → fallback: parse from plain text (less accurate; no column geometry)
//   - Types: Trainer, TrainerMon, ParseResult

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TrainerMon = {
  species: string;           // As printed in the PDF (normalized case)
  level?: number;
  item?: string;
  ability?: string;
  moves?: string[];
};

export type Trainer = {
  title: string;             // e.g. "GIMNASIO 05 - CIUDAD FUCSIA (TIPO VENENO & SINIESTRO)"
  double?: boolean;          // true if "(Combate Doble)" or similar tag is near title
  mons: TrainerMon[];
};

export type ParseResult = {
  trainers: Trainer[];
  warnings: string[];
  debug?: any;
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

const CLEAN = (s: string) =>
  s.replace(/\u00A0/g, " ")
   .replace(/[“”]/g, '"')
   .replace(/[‘’]/g, "'")
   .replace(/\s+/g, " ")
   .trim();

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
    pdfjs = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf");
    // Worker is optional if bundler inlines it; pdfjs-dist 5+ ships an ESM worker file
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

// … rest of your parsing code remains the same …

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
  // … unchanged …
}

export function toPokeApiId(species: string): string {
  let s = species.toLowerCase().replace(/\s+/g,"-");
  s = s.replace(/^mega-([a-z0-9\-]+)/, "$1-mega");
  s = s.replace(/’/g,"'");
  return s;
}
