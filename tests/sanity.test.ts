import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluate, parse } from 'groq-js';
import { demoCatalog } from '../src/lib/fixtures';
import { getCatalog } from '../src/sanity/catalog';
import { readSanitySettings } from '../src/sanity/environment';
import { CATALOG_QUERY } from '../src/sanity/queries';
import { catalogToDocuments, catalogToNdjson, type SeedDocument } from '../src/sanity/seed';
import { assertCatalog } from '../src/sanity/validate';

async function project(dataset: SeedDocument[], roomKey = demoCatalog.room.id): Promise<unknown> {
  const result = await evaluate(parse(CATALOG_QUERY), { dataset, params: { roomKey } });
  return result.get();
}

test('the actual GROQ query roundtrips the seed documents and equipment references', async () => {
  const dataset = catalogToNdjson(demoCatalog).trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(dataset.length, 1 + demoCatalog.items.length + demoCatalog.scenes.length);
  assert.equal(new Set(dataset.map((doc) => doc._id)).size, dataset.length);
  assert.deepEqual(await project(dataset), demoCatalog);
});

test('every seed ID and reference uses a public root path, so unauthenticated GROQ resolves the whole catalog', async () => {
  const dataset = catalogToDocuments(demoCatalog);
  const publicDocuments = dataset.filter((document) => !document._id.includes('.'));
  assert.equal(publicDocuments.length, 12, 'Sanity hides every dotted document ID from unauthenticated readers');
  const ids = new Set(dataset.map((document) => document._id));
  function checkReferences(value: unknown): void {
    if (Array.isArray(value)) value.forEach(checkReferences);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === '_ref') {
          assert.equal(typeof item, 'string');
          assert.ok(!String(item).includes('.'), 'a public reference must not target a private subpath');
          assert.ok(ids.has(String(item)), 'every reference must resolve within this approved seed');
        } else checkReferences(item);
      }
    }
  }
  dataset.forEach(checkReferences);
  assert.deepEqual(await project(publicDocuments), demoCatalog);
});

test('GROQ limits the catalog to the selected room, including layouts and equipment', async () => {
  const other = structuredClone(demoCatalog);
  other.room.id = 'other-room';
  other.items.forEach((item) => { item.id = `other-${item.id}`; });
  other.scenes.forEach((scene) => {
    scene.id = `other-${scene.id}`;
    scene.placements.forEach((placement) => { placement.itemId = `other-${placement.itemId}`; });
  });
  const dataset = [...catalogToDocuments(other), ...catalogToDocuments(demoCatalog)];
  assert.deepEqual(await project(dataset), demoCatalog);
  assert.equal(await project(dataset, 'missing'), null);
});

test('a cleared optional layout subtitle projects as empty text', async () => {
  const dataset = catalogToDocuments(demoCatalog);
  for (const document of dataset.filter((doc) => doc._type === 'layout')) delete document.subtitle;
  const value = await project(dataset);
  assertCatalog(value);
  assert.ok(value.scenes.every((scene) => scene.subtitle === ''));
});

test('an unresolved Sanity reference cannot reach the planner as a valid catalog', async () => {
  const dataset = catalogToDocuments(demoCatalog).filter((doc) => doc._id !== 'fliproom-equipment-chair-a');
  const value = await project(dataset);
  assert.throws(() => assertCatalog(value), /unresolved equipment reference/);
});

test('a reference to equipment in another room is rejected after dereferencing', async () => {
  const dataset = catalogToDocuments(demoCatalog);
  const foreign = { ...dataset.find((doc) => doc._type === 'equipment')!, _id: 'foreign-item', appKey: 'foreign', room: { _type: 'reference', _ref: 'other-room' } };
  const layout = dataset.find((doc) => doc._type === 'layout')!;
  (layout.placements as { equipment: { _ref: string } }[])[0].equipment._ref = foreign._id;
  const value = await project([...dataset, foreign]);
  assert.throws(() => assertCatalog(value), /unresolved equipment reference/);
});

test('only absent configuration selects demo mode; partial configuration stays an error', async () => {
  assert.equal(readSanitySettings({}).status, 'unconfigured');
  const demo = await getCatalog({}, async () => { throw new Error('Demo must not fetch'); });
  assert.equal(demo.source, 'demo');
  assert.deepEqual(demo.catalog, demoCatalog);
  for (const env of [
    { NEXT_PUBLIC_SANITY_PROJECT_ID: 'abc123' },
    { NEXT_PUBLIC_SANITY_DATASET: 'production' },
    { SANITY_ROOM_KEY: 'studio' },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: 'invalid/id', NEXT_PUBLIC_SANITY_DATASET: 'production' },
  ]) {
    const result = await getCatalog(env, async () => { throw new Error('Invalid configuration must not fetch'); });
    assert.equal(result.source, 'sanity');
    assert.equal(result.catalog, null);
    assert.ok(result.error);
  }
});

test('configured network and content failures remain visible instead of falling back to demo', async () => {
  const env = { NEXT_PUBLIC_SANITY_PROJECT_ID: 'abc123', NEXT_PUBLIC_SANITY_DATASET: 'production' };
  const network = await getCatalog(env, async () => { throw new Error('secret response detail'); });
  assert.equal(network.source, 'sanity');
  assert.equal(network.catalog, null);
  assert.ok(network.error && !network.error.includes('secret'));
  const absent = await getCatalog(env, async () => null);
  assert.equal(absent.catalog, null);
  assert.match(absent.error!, /requested room/);
  const successful = await getCatalog(env, async (query, params) => {
    assert.equal(query, CATALOG_QUERY);
    assert.equal(params.roomKey, demoCatalog.room.id);
    return project(catalogToDocuments(demoCatalog), params.roomKey);
  });
  assert.equal(successful.source, 'sanity');
  assert.deepEqual(successful.catalog, demoCatalog);
});
