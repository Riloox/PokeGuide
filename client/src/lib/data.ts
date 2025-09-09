const moveMap: Record<number, { name: string; type: string }> = {};
let movesLoaded = false;
async function loadMoves() {
  if (movesLoaded) return;
  const res = await fetch('/moves.txt');
  if (!res.ok) throw new Error('moves');
  const text = await res.text();
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(',');
    const id = parseInt(parts[0], 10);
    const name = parts[2];
    const type = parts[5]?.toLowerCase();
    if (!isNaN(id) && name) moveMap[id] = { name, type };
  });
  movesLoaded = true;
}
export async function getMove(id: number) {
  await loadMoves();
  return moveMap[id];
}

const itemMap: Record<number, string> = {};
let itemsLoaded = false;
async function loadItems() {
  if (itemsLoaded) return;
  const res = await fetch('/items_en.txt');
  if (!res.ok) throw new Error('items');
  const text = await res.text();
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(',');
    const id = parseInt(parts[0], 10);
    const name = parts[1];
    if (!isNaN(id) && name) itemMap[id] = name;
  });
  itemsLoaded = true;
}
export async function getItem(id: number) {
  await loadItems();
  return itemMap[id];
}

const abilityMap: Record<number, string> = {};
let abilitiesLoaded = false;
async function loadAbilities() {
  if (abilitiesLoaded) return;
  const res = await fetch('/abs_en.txt');
  if (!res.ok) throw new Error('abilities');
  const text = await res.text();
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(',');
    const id = parseInt(parts[0], 10);
    const name = parts[1];
    if (!isNaN(id) && name) abilityMap[id] = name;
  });
  abilitiesLoaded = true;
}
export async function getAbility(id: number) {
  await loadAbilities();
  return abilityMap[id];
}
