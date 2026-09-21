import type {Catalog, Step} from './types';

export function planSignature(catalog: Catalog, from: string, to: string): string {
  // Full content identity deliberately invalidates saved steps after any catalog edit.
  return JSON.stringify({version: 1, catalog, from, to});
}

export function validProgress(steps: Step[], ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const accepted = new Set<string>();
  for (const step of steps) {
    if (ids.includes(step.id) && step.dependsOn.every(id => accepted.has(id))) accepted.add(step.id);
  }
  return [...accepted];
}

export function toggleStep(steps: Step[], done: string[], id: string): string[] {
  const step = steps.find(value => value.id === id);
  if (!step) return done;
  if (done.includes(id)) return validProgress(steps, done.filter(value => value !== id));
  if (!step.dependsOn.every(value => done.includes(value))) return done;
  return validProgress(steps, [...done, id]);
}
