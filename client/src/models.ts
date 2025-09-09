export type TeamMon = {
  nick?: string;
  species: string;
  level?: number;
  moves: number[];
  moveNames?: string[];
  types: string[];
  ability?: string;
  item?: string;
  sprite?: string;
};

export type PcMon = TeamMon;

export type Trainer = {
  title: string;
  double?: boolean;
  roster: (string | number)[];
  moves: number[][];
};
