import type { Catalog, Item, Placement, Plan, Scene, Step } from './types';

type Rect = { x: number; y: number; width: number; height: number };
const EPSILON = 1e-8;

function footprint(item: Item, placement: Placement): Rect {
  return {
    x: placement.x,
    y: placement.y,
    width: placement.rotation === 90 ? item.height : item.width,
    height: placement.rotation === 90 ? item.width : item.height,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPSILON && a.x + a.width > b.x + EPSILON
    && a.y < b.y + b.height - EPSILON && a.y + a.height > b.y + EPSILON;
}

function fits(rect: Rect, room: Catalog['room']): boolean {
  return rect.x >= -EPSILON && rect.y >= -EPSILON
    && rect.x + rect.width <= room.width + EPSILON
    && rect.y + rect.height <= room.height + EPSILON;
}

function samePlacement(a: Placement | undefined, b: Placement | undefined): boolean {
  return a === b || Boolean(a && b && a.x === b.x && a.y === b.y && a.rotation === b.rotation);
}

function validateScene(scene: Scene, catalog: Catalog, items: Map<string, Item>): string[] {
  const blockers: string[] = [];
  const seen = new Set<string>();
  const valid: { item: Item; rect: Rect }[] = [];
  for (const placement of scene.placements) {
    const item = items.get(placement.itemId);
    if (seen.has(placement.itemId)) blockers.push(`${scene.name}: equipment ${placement.itemId} appears more than once.`);
    seen.add(placement.itemId);
    if (!item) {
      blockers.push(`${scene.name}: equipment ${placement.itemId} is missing from the catalog.`);
      continue;
    }
    if (!Number.isFinite(placement.x) || !Number.isFinite(placement.y)
      || (placement.rotation !== 0 && placement.rotation !== 90)) {
      blockers.push(`${scene.name}: ${item.label} has an invalid position or rotation.`);
      continue;
    }
    const rect = footprint(item, placement);
    if (!fits(rect, catalog.room)) blockers.push(`${scene.name}: ${item.label} extends outside the room.`);
    for (const other of valid) {
      if (overlaps(rect, other.rect)) blockers.push(`${scene.name}: ${item.label} overlaps ${other.item.label}.`);
    }
    valid.push({ item, rect });
  }
  return blockers;
}

/** Finds an endpoint for temporary parking, keeping all final destinations clear. */
function findParking(item: Item, current: Placement, room: Catalog['room'], occupied: Rect[], destinations: Rect[]): Placement | null {
  const size = footprint(item, current);
  const obstacles = [...occupied, ...destinations];
  const xs = new Set([0, room.width - size.width]);
  const ys = new Set([0, room.height - size.height]);
  for (const rect of obstacles) {
    xs.add(rect.x + rect.width);
    xs.add(rect.x - size.width);
    ys.add(rect.y + rect.height);
    ys.add(rect.y - size.height);
  }
  for (const y of [...ys].sort((a, b) => a - b)) {
    for (const x of [...xs].sort((a, b) => a - b)) {
      const candidate = { ...size, x, y };
      if (fits(candidate, room) && obstacles.every((rect) => !overlaps(candidate, rect))) {
        return { itemId: item.id, x, y, rotation: current.rotation };
      }
    }
  }
  return null;
}

/** Plans endpoint occupancy only; people, doorways and movement paths are not modeled. */
export function buildPlan(catalog: Catalog, fromSceneId: string, toSceneId: string): Plan {
  const blockers: string[] = [];
  const empty = (): Plan => ({ steps: [], blockers, totalMinutes: 0, movedCount: 0 });
  if (![catalog.room.width, catalog.room.height].every((n) => Number.isFinite(n) && n > 0)) {
    blockers.push('The room must have finite, positive dimensions.');
  }
  const items = new Map<string, Item>();
  for (const item of catalog.items) {
    if (!item.id || items.has(item.id)) blockers.push(`Equipment ID ${item.id || '(empty)'} must be unique and nonempty.`);
    if (![item.width, item.height].every((n) => Number.isFinite(n) && n > 0)) {
      blockers.push(`${item.label}: equipment dimensions must be finite and positive.`);
    }
    if (!Number.isFinite(item.minutes) || item.minutes < 0) blockers.push(`${item.label}: move time must be finite and nonnegative.`);
    if (!['chair', 'table', 'screen', 'cart', 'mat'].includes(item.kind)) blockers.push(`${item.label}: unknown equipment kind.`);
    items.set(item.id, item);
  }
  const sceneIds = new Set<string>();
  for (const scene of catalog.scenes) {
    if (!scene.id || sceneIds.has(scene.id)) blockers.push(`Scene ID ${scene.id || '(empty)'} must be unique and nonempty.`);
    sceneIds.add(scene.id);
  }
  const fromScene = catalog.scenes.find((scene) => scene.id === fromSceneId);
  const toScene = catalog.scenes.find((scene) => scene.id === toSceneId);
  if (!fromScene) blockers.push(`Source scene ${fromSceneId} does not exist.`);
  if (!toScene) blockers.push(`Target scene ${toSceneId} does not exist.`);
  if (blockers.length || !fromScene || !toScene) return empty();
  blockers.push(...validateScene(fromScene, catalog, items));
  if (toScene !== fromScene) blockers.push(...validateScene(toScene, catalog, items));
  if (blockers.length) return empty();

  const current = new Map(fromScene.placements.map((p) => [p.itemId, { ...p }]));
  const target = new Map(toScene.placements.map((p) => [p.itemId, { ...p }]));
  const pending = new Set([...items.keys()].filter((id) => !samePlacement(current.get(id), target.get(id))));
  const movedCount = pending.size;
  const steps: Step[] = [];
  const lastStep = new Map<string, string>();
  const vacated: { rect: Rect; stepId: string }[] = [];
  const destinations = [...target.values()].map((p) => footprint(items.get(p.itemId)!, p));
  const orderedPending = () => [...pending].sort();
  const isClear = (id: string, placement: Placement) => [...current.entries()].every(([otherId, other]) => (
    id === otherId || !overlaps(footprint(items.get(id)!, placement), footprint(items.get(otherId)!, other))
  ));

  function addStep(id: string, kind: Step['kind'], to: Placement | null): void {
    const item = items.get(id)!;
    const from = current.get(id) ?? null;
    const destination = to ? footprint(item, to) : null;
    const dependsOn = new Set<string>();
    const previous = lastStep.get(id);
    if (previous) dependsOn.add(previous);
    if (destination) {
      for (const clear of vacated) if (overlaps(destination, clear.rect)) dependsOn.add(clear.stepId);
    }
    const stepId = `step-${steps.length + 1}`;
    const point = to ? `(${Number(to.x.toFixed(2))}, ${Number(to.y.toFixed(2))}) m` : '';
    const position = to ? `${point}, orientation ${to.rotation}°` : '';
    const label = kind === 'park'
      ? to ? `Park ${item.label} temporarily at ${position}` : `Park ${item.label} in temporary storage outside the room`
      : kind === 'store' ? `Store ${item.label} outside the room`
        : `${kind === 'retrieve' ? 'Retrieve' : 'Move'} ${item.label} to ${position}`;
    steps.push({ id: stepId, itemId: id, kind, label, from: from ? { ...from } : null, to: to ? { ...to } : null, dependsOn: [...dependsOn], minutes: item.minutes });
    if (from) vacated.push({ rect: footprint(item, from), stepId });
    lastStep.set(id, stepId);
    if (to) current.set(id, { ...to });
    else current.delete(id);
  }

  while (pending.size) {
    const ready = orderedPending().find((id) => !target.has(id) || isClear(id, target.get(id)!));
    if (ready !== undefined) {
      const destination = target.get(ready) ?? null;
      addStep(ready, destination ? current.has(ready) ? 'move' : 'retrieve' : 'store', destination);
      pending.delete(ready);
      continue;
    }
    // Park an actual blocker, not a previously parked item waiting on another cycle.
    const blockerId = orderedPending().find((id) => {
      const placement = current.get(id);
      return placement && orderedPending().some((otherId) => otherId !== id && target.has(otherId)
        && overlaps(footprint(items.get(id)!, placement), footprint(items.get(otherId)!, target.get(otherId)!)));
    });
    if (blockerId === undefined) {
      blockers.push('No executable transition was found. Check the layouts before moving equipment.');
      return empty();
    }
    const occupied = [...current.entries()].filter(([id]) => id !== blockerId).map(([id, p]) => footprint(items.get(id)!, p));
    addStep(blockerId, 'park', findParking(items.get(blockerId)!, current.get(blockerId)!, catalog.room, occupied, destinations));
  }
  return { steps, blockers, movedCount, totalMinutes: steps.reduce((sum, step) => sum + step.minutes, 0) };
}
