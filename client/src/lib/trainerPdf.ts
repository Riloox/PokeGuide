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
    // Worker is optional if bundler inlines it; suppress if not found
    try {
      const workerSrc = (await import(/* @vite-ignore */ "pdfjs-dist/build/pdf.worker.js?url")).default;
      if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    } catch { /* ignore */ }
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

// Split full text into blocks by titles detected with TITLE_MARKERS.
function splitByBattlesFromLines(lines: {y:number;text:string;items:any[]}[]) {
  const indices: number[] = [];
  for (let i=0;i<lines.length;i++) {
    const t = lines[i].text;
    if (TITLE_MARKERS.some(rx => rx.test(t))) indices.push(i);
  }
  // add last index sentinel
  indices.push(lines.length);

  const blocks: { title: string; double: boolean; lines: typeof lines }[] = [];
  for (let bi=0; bi<indices.length-1; bi++) {
    const start = indices[bi];
    const end = indices[bi+1];
    const title = lines[start]?.text || "Combate";
    const rest = lines.slice(start+1, end);
    const double = DOUBLE_MARKERS.some(rx => rx.test(title)) || rest.some(l => DOUBLE_MARKERS.some(rx => rx.test(l.text)));
    blocks.push({ title: CLEAN(title), double, lines: rest });
  }
  return blocks;
}

function extractMonsFromBlock(block: {title:string;double:boolean;lines:{y:number;text:string;items:any[]}[]}) : TrainerMon[] {
  const mons: TrainerMon[] = [];
  if (!block.lines.length) return mons;

  // Find species line(s): first 1–2 lines that look like uppercase Pokémon columns (excluding type line that follows immediately)
  const speciesCandidateIdx = block.lines.findIndex(ln => {
    const tokens = ln.text.split(/\s{2,}|\s(?=[A-Z]{2,})/);
    const looks = tokens.filter(looksLikeSpeciesCell);
    return looks.length >= 2; // at least two columns
  });

  if (speciesCandidateIdx < 0) return mons;

  // Decide block span: from species line until we hit an empty line or next title-ish line or many service lines
  let endIdx = block.lines.length;
  for (let i=speciesCandidateIdx+1;i<block.lines.length;i++) {
    const t = block.lines[i].text;
    if (TITLE_MARKERS.some(rx=>rx.test(t))) { endIdx = i; break; }
  }
  const lines = block.lines.slice(speciesCandidateIdx, endIdx);

  // Build columns
  const columns = blockToColumns(lines);

  // Heuristically detect how many columns are "real mons": a column must start with a species-ish token
  const monCols = columns.filter(col => {
    const top = col.cells[0]?.text || "";
    const text = top.replace(/^MEGA\s+/, "");
    return looksLikeSpeciesCell(text);
  });

  // Initialize mon objects
  for (const col of monCols) {
    // Merge "MEGA\nX" or region lines like "SLOWKING-GALAR"
    const header = col.cells[0]?.text || "";
    let species = header;
    if (/^MEGA\b/.test(header) && col.cells[1]) {
      species = header + " " + col.cells[1].text;
    }
    mons.push({ species: normSpecies(species), moves: [] });
  }

  // For each column, scan its cells to extract Level, Item, Ability, Moves
  const parseMovesFromCol = (colText: string[]) => {
    const out: string[] = [];
    for (const raw of colText) {
      const t = CLEAN(raw);
      if (!t) continue;
      if (SERVICE_LINES.some(rx=>rx.test(t))) continue;
      if (TYPE_WORDS.has(t)) continue;
      if (POTION_WORDS.has(t.toUpperCase())) continue;
      if (/^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+:/.test(t)) continue; // "Obj: Ninguno" style
      if (/^(\d+|Nivel|Niveles)\b/i.test(t)) continue;
      if (/^(BROCK|MISTY|LT\.? SURGE|ERIKA|SABRINA|BLAINE|KOGA|GIOVANNI|ATLAS|ATHENEA|URANO|PETRA|ALANA|ERICO|VITO|LETI|ROJO|AZUL|Lorelei|Bruno|Agatha|Lance|Máximo|Cintia|Mirto|BILL|OAK|SURYA|VIRGILIO)\b/i.test(t)) continue; // trainer name lines within the grid
      // Filters for known non-move tokens often found in middle
      if (/^\(\w+.*\)$/.test(t)) continue; // parenthetical notes
      // Accept the rest as moves
      out.push(t);
    }
    // Limit to 4 common moves
    const uniq = Array.from(new Set(out));
    return uniq.slice(0, 4);
  };

  // Map columns to mons
  for (let i=0;i<monCols.length;i++) {
    const col = monCols[i];
    const mon = mons[i];
    const texts = col.cells.map(c => c.text);

    // Level
    const lvl = texts.find(t => /Nivel\s*:\s*\d+/.test(t));
    mon.level = lvl ? asInt(lvl) : mon.level;

    // Item (OBJ)
    const obj = texts.find(t => /^(OBJ|Obj)\s*:/.test(t));
    if (obj) mon.item = CLEAN(obj.replace(/^(OBJ|Obj)\s*:\s*/,""));

    // Ability (HAB)
    const hab = texts.find(t => /^(HAB|Hab)\s*:/.test(t));
    if (hab) mon.ability = CLEAN(hab.replace(/^(HAB|Hab)\s*:\s*/,""));

    // Moves
    const moves = parseMovesFromCol(texts);
    mon.moves = moves;
  }

  // Fix species header for "MEGA" two-line headers
  for (const mon of mons) {
    mon.species = mon.species.replace(/\bPSIQUICO\b/g,"PSÍQUICO"); // cosmetic
  }

  return mons;
}

function assembleResult(blocks: {title:string;double:boolean;lines:any[]}[]): ParseResult {
  const trainers: Trainer[] = [];
  const warnings: string[] = [];

  for (const b of blocks) {
    const mons = extractMonsFromBlock(b);
    if (!mons.length) {
      warnings.push(`No mons parsed for: ${b.title}`);
      continue;
    }
    trainers.push({ title: b.title, double: b.double, mons });
  }
  return { trainers, warnings };
}

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

// Fallback parser: accepts plain text extracted elsewhere (no geometry), best-effort.
export function parseText(txt: string): ParseResult {
  const lines = CLEAN(txt).split(/\n+/).map(L => ({ y: 0, text: L, items: [] as any[] }));
  const blocks = splitByBattlesFromLines(lines);
  // In text-only mode we can't rebuild columns; we approximate by splitting words sequences.
  for (const b of blocks) {
    // Heuristic: read the first line after title as "species list" split by spaces; stop before 'Nivel:'
    const idx = b.lines.findIndex(l => /\bNivel\b/i.test(l.text));
    const head = b.lines.slice(0, idx >= 0 ? idx : Math.min(4, b.lines.length)).map(l => l.text).join(" ");
    const allTokens = head.split(/\s{2,}|\s(?=[A-ZÁÉÍÓÚÜÑ]{2,}\b)/).map(CLEAN).filter(Boolean);
    const speciesTokens: string[] = [];
    for (const t of allTokens) {
      if (looksLikeSpeciesCell(t) && !TYPE_WORDS.has(t)) speciesTokens.push(t);
    }
    const mons: TrainerMon[] = speciesTokens.map(t => ({ species: normSpecies(t), moves: [] }));
    // Moves—best effort: collect next few lines until next title, filter service words
    const tail = b.lines.slice(0, Math.min(12, b.lines.length)).map(l => l.text).join(" ");
    const moveCandidates = tail.split(/\s{1,}/).filter(Boolean);
    const filtered = moveCandidates.filter(m => {
      const T = m.toUpperCase();
      if (POTION_WORDS.has(T)) return false;
      if (TYPE_WORDS.has(T)) return false;
      if (/^(OBJ|HAB|Nivel)\b/i.test(m)) return false;
      return isUpperish(m);
    }).slice(0, mons.length * 4);
    // Distribute moves in round-robin
    for (let i=0;i<filtered.length;i++) {
      const mon = mons[i % Math.max(1, mons.length)];
      (mon.moves ||= []).push(filtered[i]);
    }
    b.lines = []; // free memory
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

// Name mapping helpers (optional): Mega and regional normalized ids
export function toPokeApiId(species: string): string {
  let s = species.toLowerCase().replace(/\s+/g,"-");
  // Mega forms
  s = s.replace(/^mega-([a-z0-9\-]+)/, "$1-mega");
  // Galar/Alola/Hisui forms already use dash
  s = s.replace(/’/g,"'"); // normalize apostrophes
  return s;
}
