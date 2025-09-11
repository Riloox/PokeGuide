export function normalizeText(str: string): string {
  return str.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}
