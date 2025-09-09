export const typeColors: Record<string, string> = {
  normal: 'bg-gray-400 text-black',
  fire: 'bg-red-500 text-white',
  water: 'bg-blue-500 text-white',
  grass: 'bg-green-500 text-white',
  electric: 'bg-yellow-300 text-black',
  ice: 'bg-cyan-300 text-black',
  fighting: 'bg-red-700 text-white',
  poison: 'bg-purple-600 text-white',
  ground: 'bg-yellow-700 text-white',
  flying: 'bg-indigo-300 text-black',
  psychic: 'bg-pink-500 text-white',
  bug: 'bg-lime-500 text-black',
  rock: 'bg-yellow-600 text-white',
  ghost: 'bg-purple-800 text-white',
  dragon: 'bg-indigo-700 text-white',
  dark: 'bg-gray-700 text-white',
  steel: 'bg-gray-500 text-white',
  fairy: 'bg-pink-300 text-black',
};

export const typeNames: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  grass: 'Planta',
  electric: 'Eléctrico',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
};

export function TypeBadge({ type }: { type: string }) {
  const cls = typeColors[type] || 'bg-gray-500 text-white';
  return <span className={`px-1 py-0.5 rounded ${cls}`}>{typeNames[type] || type}</span>;
}
