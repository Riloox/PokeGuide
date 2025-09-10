export type TeamMon = {
  nick?: string;
  species: string;
  speciesName?: string;
  level?: number;
  moves: number[];
  moveNames?: string[];
  types: string[];
  ability?: string | number;
  item?: string | number;
  sprite?: string;
};

export type PcMon = TeamMon;

export type Trainer = {
  title: string;
  double?: boolean;
  roster: (string | number)[];
  moves: number[][];
};
