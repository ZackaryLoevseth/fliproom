import assert from 'node:assert/strict';
import test from 'node:test';
import { demoCatalog } from '../src/lib/fixtures';
import { buildPlan } from '../src/lib/planner';
import type { Catalog, Item, Placement, Scene } from '../src/lib/types';

const item = (id: string, width = 1, height = 1): Item => ({ id, label: id, kind: 'table', width, height, minutes: 2 });
const at = (itemId: string, x: number, y = 0, rotation: 0 | 90 = 0): Placement => ({ itemId, x, y, rotation });
const scene = (id: string, placements: Placement[]): Scene => ({ id, name: id, subtitle: '', color: '#000', placements });
const catalog = (from: Placement[], to: Placement[], width = 6, height = 4): Catalog => ({
  room: { id: 'room', name: 'Room', width, height },
  items: [item('a'), item('b'), item('c')],
  scenes: [scene('from', from), scene('to', to)],
});

function assertExecutable(input: Catalog, fromId: string, toId: string): void {
  const result = buildPlan(input, fromId, toId);
  assert.deepEqual(result.blockers, []);
  const positions = new Map(input.scenes.find((s) => s.id === fromId)!.placements.map((p) => [p.itemId, p]));
  const completed = new Set<string>();
  for (const step of result.steps) {
    assert.ok(step.dependsOn.every((id) => completed.has(id)), 'dependencies must precede their step');
    assert.deepEqual(step.from, positions.get(step.itemId) ?? null);
    if (step.to) {
      const moving = input.items.find((i) => i.id === step.itemId)!;
      const w = step.to.rotation === 90 ? moving.height : moving.width;
      const h = step.to.rotation === 90 ? moving.width : moving.height;
      assert.ok(step.to.x >= -1e-8 && step.to.y >= -1e-8);
      assert.ok(step.to.x + w <= input.room.width + 1e-8 && step.to.y + h <= input.room.height + 1e-8);
      for (const [id, other] of positions) {
        if (id === step.itemId) continue;
        const equipment = input.items.find((i) => i.id === id)!;
        const ow = other.rotation === 90 ? equipment.height : equipment.width;
        const oh = other.rotation === 90 ? equipment.width : equipment.height;
        const separated: boolean = step.to.x + w <= other.x + 1e-8 || other.x + ow <= step.to.x + 1e-8
          || step.to.y + h <= other.y + 1e-8 || other.y + oh <= step.to.y + 1e-8;
        assert.ok(separated, `${step.itemId} would overlap ${id}`);
      }
      positions.set(step.itemId, step.to);
    } else positions.delete(step.itemId);
    completed.add(step.id);
  }
  const ordered = (placements: Placement[]) => placements.toSorted((a, b) => a.itemId.localeCompare(b.itemId));
  assert.deepEqual(ordered([...positions.values()]), ordered(input.scenes.find((s) => s.id === toId)!.placements));
  assert.equal(result.totalMinutes, result.steps.reduce((sum, step) => sum + step.minutes, 0));
}

test('all fictional scenes are valid and every transition reaches its target without endpoint collisions', () => {
  const original = structuredClone(demoCatalog);
  for (const from of demoCatalog.scenes) for (const to of demoCatalog.scenes) assertExecutable(demoCatalog, from.id, to.id);
  assert.deepEqual(demoCatalog, original, 'planning must not mutate catalog data');
});

test('same layout produces no work, including different scene IDs with identical placements', () => {
  assert.deepEqual(buildPlan(catalog([at('a', 0)], [at('a', 0)]), 'from', 'to'), {
    steps: [], blockers: [], totalMinutes: 0, movedCount: 0,
  });
});

test('a blocked move waits for the blocking item to vacate, regardless of input order', () => {
  const input = catalog([at('a', 0), at('b', 1)], [at('a', 1), at('b', 2)]);
  const result = buildPlan(input, 'from', 'to');
  assert.deepEqual(result.steps.map((s) => s.itemId), ['b', 'a']);
  assert.deepEqual(result.steps[1].dependsOn, [result.steps[0].id]);
  const reordered = structuredClone(input);
  reordered.items.reverse();
  reordered.scenes.forEach((s) => s.placements.reverse());
  assert.deepEqual(buildPlan(reordered, 'from', 'to'), result);
  assertExecutable(input, 'from', 'to');
});

test('a swap parks one item inside the room before returning it to its target', () => {
  const input = catalog([at('a', 0), at('b', 1)], [at('a', 1), at('b', 0)]);
  const result = buildPlan(input, 'from', 'to');
  assert.equal(result.steps[0].kind, 'park');
  assert.ok(result.steps[0].to, 'a free staging area should be used');
  assert.equal(result.steps.length, 3);
  assert.equal(result.movedCount, 2);
  assert.equal(result.totalMinutes, 6);
  assert.ok(result.steps.at(-1)!.dependsOn.includes(result.steps[0].id));
  assertExecutable(input, 'from', 'to');
});

test('a full-room cycle explicitly uses temporary outside storage and retrieval', () => {
  const input = catalog([at('a', 0), at('b', 1), at('c', 2)], [at('a', 1), at('b', 2), at('c', 0)], 3, 1);
  const result = buildPlan(input, 'from', 'to');
  assert.equal(result.steps[0].kind, 'park');
  assert.equal(result.steps[0].to, null);
  assert.match(result.steps[0].label, /outside the room/);
  assert.equal(result.steps.at(-1)!.kind, 'retrieve');
  assertExecutable(input, 'from', 'to');
});

test('storage and retrieval count as changed equipment and unblock destinations', () => {
  const input = catalog([at('a', 0)], [at('b', 0)]);
  const result = buildPlan(input, 'from', 'to');
  assert.deepEqual(result.steps.map((s) => s.kind), ['store', 'retrieve']);
  assert.deepEqual(result.steps[1].dependsOn, [result.steps[0].id]);
  assert.equal(result.movedCount, 2);
  assertExecutable(input, 'from', 'to');
});

test('rotation changes footprints, permits touching edges, and is a real move', () => {
  const input = catalog([at('a', 0)], [at('a', 0, 0, 90), at('b', 1)]);
  input.items[0] = item('a', 2, 1);
  const result = buildPlan(input, 'from', 'to');
  assert.deepEqual(result.blockers, []);
  assert.equal(result.movedCount, 2);
  assertExecutable(input, 'from', 'to');
  input.scenes[1].placements[0] = at('a', 5.5, 0, 90);
  assert.match(buildPlan(input, 'from', 'to').blockers.join(' '), /outside/);
});

test('invalid target overlap, missing equipment and duplicate placements block all work', () => {
  for (const placements of [[at('a', 0), at('b', 0.5)], [at('missing', 0)], [at('a', 0), at('a', 2)]]) {
    const result = buildPlan(catalog([], placements), 'from', 'to');
    assert.ok(result.blockers.length);
    assert.deepEqual(result.steps, []);
    assert.equal(result.totalMinutes, 0);
  }
});

test('instructions state absolute target orientation when returning a rotated item to zero degrees', () => {
  const input = catalog([at('a', 0, 0, 90)], [at('a', 2, 0, 0)]);
  input.items[0] = item('a', 2, 1);
  const result = buildPlan(input, 'from', 'to');
  assert.equal(result.steps.length, 1);
  assert.match(result.steps[0].label, /orientation 0°/);
  assertExecutable(input, 'from', 'to');
});

test('invalid source layout, IDs, dimensions, positions, times and unknown scenes are rejected', () => {
  const changes: ((c: Catalog) => void)[] = [
    (c) => { c.room.width = 0; },
    (c) => { c.items[0].height = Number.NaN; },
    (c) => { c.items[0].minutes = -1; },
    (c) => { c.items.push({ ...c.items[0] }); },
    (c) => { c.scenes[1].id = 'from'; },
    (c) => { c.scenes[0].placements.push(at('b', 0)); },
    (c) => { c.scenes[1].placements[0].x = Number.POSITIVE_INFINITY; },
    (c) => { c.scenes[1].placements[0].rotation = 45 as 0; },
  ];
  for (const change of changes) {
    const input = catalog([at('a', 0)], [at('a', 2)]);
    change(input);
    const result = buildPlan(input, 'from', 'to');
    assert.ok(result.blockers.length);
    assert.deepEqual(result.steps, []);
  }
  assert.match(buildPlan(catalog([], []), 'absent', 'to').blockers.join(' '), /does not exist/);
});
