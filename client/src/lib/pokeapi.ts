import { typeChart } from './typeChart';

const base = 'https://pokeapi.co/api/v2';

function cacheGet(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getPokemon(idOrName: string) {
  const key = `poke_${idOrName}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const res = await fetch(`${base}/pokemon/${idOrName}`);
  if (!res.ok) throw new Error('pokeapi');
  const data = await res.json();

  const bw =
    data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
    data.sprites.versions?.['generation-v']?.['black-white']?.front_default ||
    data.sprites.front_default;

  const out = {
    types: data.types.map((t: any) => t.type.name),
    sprite: bw || data.sprites.other['official-artwork'].front_default,
  };

  cacheSet(key, out);
  return out;
}

export async function getType(name: string) {
  const key = `type_${name}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const res = await fetch(`${base}/type/${name}`);
  if (!res.ok) throw new Error('pokeapi');
  const data = await res.json();
  cacheSet(key, data);
  return data;
}

export function getMultiplier(moveType: string, targetTypes: string[]): number {
  let mult = 1;
  const chart = typeChart[moveType] || {};
  for (const t of targetTypes) {
    mult *= chart[t] ?? 1;
  }
  return mult;
}

