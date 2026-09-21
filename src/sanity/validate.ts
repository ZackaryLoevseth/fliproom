import type { Catalog } from '../lib/types';

export type { Catalog } from '../lib/types';
const kinds = new Set(['chair', 'table', 'screen', 'cart', 'mat']);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Validate remote data before the geometry engine or UI receives it. */
export function assertCatalog(value: unknown): asserts value is Catalog {
  if (!record(value) || !record(value.room) || !text(value.room.id) ||
      !text(value.room.name) || !positive(value.room.width) || !positive(value.room.height)) {
    throw new Error('The requested room is missing or has invalid dimensions.');
  }
  if (!Array.isArray(value.items) || !value.items.length ||
      !Array.isArray(value.scenes) || value.scenes.length < 2) {
    throw new Error('The room needs equipment and at least two published layouts.');
  }
  const itemIds = new Set<string>();
  for (const item of value.items) {
    if (!record(item) || !text(item.id) || itemIds.has(item.id) || !text(item.label) ||
        typeof item.kind !== 'string' || !kinds.has(item.kind) || !positive(item.width) ||
        !positive(item.height) || !positive(item.minutes)) {
      throw new Error('Equipment contains invalid fields or duplicate app keys.');
    }
    itemIds.add(item.id);
  }
  const sceneIds = new Set<string>();
  for (const scene of value.scenes) {
    if (!record(scene) || !text(scene.id) || sceneIds.has(scene.id) || !text(scene.name) ||
        typeof scene.subtitle !== 'string' || typeof scene.color !== 'string' ||
        !/^#[0-9a-fA-F]{6}$/.test(scene.color) || !Array.isArray(scene.placements)) {
      throw new Error('A layout contains invalid fields or a duplicate app key.');
    }
    sceneIds.add(scene.id);
    const placedIds = new Set<string>();
    for (const placement of scene.placements) {
      if (!record(placement) || !text(placement.itemId) || !itemIds.has(placement.itemId) ||
          placedIds.has(placement.itemId) || !nonnegative(placement.x) ||
          !nonnegative(placement.y) || (placement.rotation !== 0 && placement.rotation !== 90)) {
        throw new Error('A layout has an unresolved equipment reference, duplicate placement, or invalid position.');
      }
      placedIds.add(placement.itemId);
    }
  }
}
