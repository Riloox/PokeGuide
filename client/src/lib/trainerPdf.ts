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
  // Uppercase-ish name, may include hyphens or MEGA tag on preceding line
  const t = CLEAN(s).replace(/^MEGA\s+/, "");
  return isUpperish(t) && !TYPE_WORDS.has(t) && !/^(OBJ|HAB|Nivel|Obj|Hab)\b/i.test(t);
};

const asInt = (s: string | undefined) => {
  if (!s) return undefined;
  const m = String(s).match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : undefined;
};

// Normalize Spanish names that sometimes use accents or casing
const normMove = (s: string) => CLEAN(s).toLowerCase();
const normSpecies = (s: string) => CLEAN(s).replace(/\s+/g, " ").trim();

// -------------------------- PDF.js adapter --------------------------

/**
 * Read text items (with x,y) from a PDF binary using pdfjs-dist (if available).
 * Returns items grouped by page, each item = {str, x, y, width}.
 */
async function readPdfTextItems(data: ArrayBuffer | Uint8Array) {
  let pdfjs: any;
  try {
    // Works if consumer installed `pdfjs-dist`
    pdfjs = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf");
    // Worker is optional if bundler inlines it; pdfjs-dist 5+ uses an .mjs worker file
    try {
      const workerSrc = (
        await import(
          /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
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

// Group items into lines using Y proximity; returns [{y, text, items[]}] sorted top→bottom.
function itemsToLines(items: {str:string,x:number,y:number,width:number}[], yTol = 2) {
  const acc: { y: number; items: typeof items; }[] = [];
  for (const it of items) {
    const found = acc.find(g => Math.abs(g.y - it.y) <= yTol);
    if (found) found.items.push(it);
    else acc.push({ y: it.y, items: [it] });
  }
  acc.sort((a,b) => b.y - a.y); // pdfjs y grows upwards; we want top→bottom
  const lines = acc.map(g => {
    g.items.sort((a,b) => a.x - b.x);
    return { y: g.y, items: g.items, text: g.items.map(i => i.str).join(" ").replace(/\s+/g," ").trim() };
  });
  return lines;
}

// Cluster X positions to "columns" for a block; returns sorted centers.
function clusterColumns(items: {x:number,width:number}[], xTol = 12): number[] {
  const xs = [...new Set(items.map(i => Math.round(i.x)))].sort((a,b) => a-b);
  const cols: number[] = [];
  for (const x of xs) {
    const last = cols[cols.length-1];
    if (cols.length === 0 || Math.abs(last - x) > xTol) cols.push(x);
  }
  return cols;
}

// Given a slice of lines that make one fight block, reconstruct columns and per-column stacks.
function blockToColumns(lines: {y:number,text:string,items:{str:string,x:number,y:number,width:number}[]}[]) {
  // Use all items from these lines to find columns
  const allItems = lines.flatMap(l => l.items);
  const colXs = clusterColumns(allItems, 14);
  const columns: { x: number; cells: { y:number; text:string }[] }[] = colXs.map(x => ({ x, cells: [] }));

  for (const ln of lines) {
    for (const it of ln.items) {
      // assign to closest column
      let bestIdx = 0, bestDist = Infinity;
      for (let i=0;i<columns.length;i++){
        const d = Math.abs(columns[i].x - it.x);
        if (d < bestDist){ bestDist = d; bestIdx = i; }
      }
      const col = columns[bestIdx];
      col.cells.push({ y: ln.y, text: CLEAN(it.str) });
    }
  }
  // sort each column top→bottom
  for (const col of columns) {
    // merge small fragments that belong to same row (same y)
    const byY: Record<number,string[]> = {};
    for (const c of col.cells) {
      const key = Math.round(c.y);
      byY[key] = byY[key] || [];
      byY[key].push(c.text);
    }
    const merged = Object.entries(byY).map(([y, parts]) => ({ y: Number(y), text: CLEAN(parts.join(" ")) }));
    merged.sort((a,b) => b.y - a.y);
    (col as any).cells = merged;
  }
  return columns;
}

// -------------------------- High-level parse --------------------------

// … (rest of your parsing code unchanged)

// -------------------------- Public API --------------------------

export async function parsePdf(data: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  const pages = await readPdfTextItems(data);
  // Flatten all lines from all pages
  const allLines: { y:number;text:string;items:any[] }[] = [];
  for (const pg of pages) {
    const lines = itemsToLines(pg.items);
    // Drop empty
    allLines.push(...lines.filter(l => l.text));
  }
  const blocks = splitByBattlesFromLines(allLines);
  const res = assembleResult(blocks);
  (res as any).debug = { pages: pages.length, lines: allLines.length, blocks: blocks.length };
  return res;
}

// Legacy wrapper retained for existing imports that expect an array.
export async function parseTrainerPdf(
  data: ArrayBuffer | Uint8Array,
): Promise<Trainer[]> {
  const res = await parsePdf(data);
  return res.trainers;
}

// Fallback parser: accepts plain text extracted elsewhere (no geometry), best-effort.
export function parseText(txt: string): ParseResult {
  // … unchanged …
}

// Name mapping helpers (optional): Mega and regional normalized ids
export function toPokeApiId(species: string): string {
  let s = species.toLowerCase().replace(/\s+/g,"-");
  s = s.replace(/^mega-([a-z0-9\-]+)/, "$1-mega");
  s = s.replace(/’/g,"'"); 
  return s;
}
