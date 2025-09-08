export type TeamMon = {
  nick?: string;
  species: string;
  level?: number;
  moves: string[];
  types: string[];
  ability?: string;
  item?: string;
  sprite?: string;
};

export type PcMon = {
  nick?: string;
  species: string;
  types: string[];
  ability?: string;
  item?: string;
  sprite?: string;
};

export type Trainer = {
  title: string;
  double?: boolean;
  roster: (string | number)[];
  moves: string[][];
};
