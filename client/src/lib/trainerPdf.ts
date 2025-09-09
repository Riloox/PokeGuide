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
  const t = s.replace(/[^A-ZÁÉ]()
