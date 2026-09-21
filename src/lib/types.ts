export type ItemKind = 'chair' | 'table' | 'screen' | 'cart' | 'mat';

export type Item = {
  id: string;
  label: string;
  kind: ItemKind;
  width: number;
  height: number;
  minutes: number;
};

/** Top-left coordinates in metres. A 90-degree rotation swaps width and height. */
export type Placement = {
  itemId: string;
  x: number;
  y: number;
  rotation: 0 | 90;
};

export type Scene = {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  placements: Placement[];
};

export type Catalog = {
  room: { id: string; name: string; width: number; height: number };
  items: Item[];
  scenes: Scene[];
};

export type Step = {
  id: string;
  itemId: string;
  kind: 'move' | 'store' | 'retrieve' | 'park';
  label: string;
  from: Placement | null;
  to: Placement | null;
  dependsOn: string[];
  minutes: number;
};

export type Plan = {
  steps: Step[];
  blockers: string[];
  totalMinutes: number;
  movedCount: number;
};
