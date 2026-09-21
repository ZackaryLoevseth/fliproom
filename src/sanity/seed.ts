import type { Catalog } from './validate';
import { assertCatalog } from './validate';

export type SeedDocument = { _id: string; _type: string; [key: string]: unknown };

function documentId(type: string, key: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error(`Invalid app key for seed document: ${key}`);
  // Dotted IDs are private Sanity subpaths even in a public dataset.
  // Root-path IDs allow the approved fictional content to be read without a token.
  return `fliproom-${type}-${key}`;
}

/** Pure transformation: no client, network calls, imports, or account writes. */
export function catalogToDocuments(catalog: Catalog): SeedDocument[] {
  assertCatalog(catalog);
  const roomId = documentId('room', catalog.room.id);
  const room = { _type: 'reference', _ref: roomId };
  return [
    { _id: roomId, _type: 'room', appKey: catalog.room.id, name: catalog.room.name, width: catalog.room.width, height: catalog.room.height },
    ...catalog.items.map(({ id, ...item }, sortOrder) => ({
      _id: documentId('equipment', id), _type: 'equipment', appKey: id, ...item, room, sortOrder,
    })),
    ...catalog.scenes.map(({ id, placements, ...scene }, sortOrder) => ({
      _id: documentId('layout', id), _type: 'layout', appKey: id, ...scene, room, sortOrder,
      placements: placements.map(({ itemId, ...placement }) => ({
        _type: 'placement', _key: itemId, equipment: { _type: 'reference', _ref: documentId('equipment', itemId) }, ...placement,
      })),
    })),
  ];
}

export function catalogToNdjson(catalog: Catalog): string {
  return catalogToDocuments(catalog).map((doc) => JSON.stringify(doc)).join('\n') + '\n';
}
