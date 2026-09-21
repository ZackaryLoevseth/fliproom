import type { Catalog } from './types';

export const demoCatalog: Catalog = {
  room: { id: 'studio', name: 'The Commons', width: 12, height: 8 },
  items: [
    { id: 'chair-a', label: 'Chair A', kind: 'chair', width: 0.65, height: 0.7, minutes: 1 },
    { id: 'chair-b', label: 'Chair B', kind: 'chair', width: 0.65, height: 0.7, minutes: 1 },
    { id: 'chair-c', label: 'Chair C', kind: 'chair', width: 0.65, height: 0.7, minutes: 1 },
    { id: 'table-main', label: 'Workshop table', kind: 'table', width: 2.4, height: 1.1, minutes: 3 },
    { id: 'table-side', label: 'Side table', kind: 'table', width: 1.8, height: 0.8, minutes: 2 },
    { id: 'screen', label: 'Mobile screen', kind: 'screen', width: 2.2, height: 0.5, minutes: 2 },
    { id: 'cart', label: 'Supply cart', kind: 'cart', width: 0.8, height: 0.9, minutes: 1 },
    { id: 'mat', label: 'Activity mat', kind: 'mat', width: 3, height: 2, minutes: 2 },
  ],
  scenes: [
    {
      id: 'workshop',
      name: 'Workshop',
      subtitle: 'Make space for hands-on ideas.',
      color: '#d69d4b',
      placements: [
        { itemId: 'table-main', x: 4.5, y: 2, rotation: 0 },
        { itemId: 'table-side', x: 1, y: 1, rotation: 90 },
        { itemId: 'chair-a', x: 4.65, y: 3.5, rotation: 0 },
        { itemId: 'chair-b', x: 5.85, y: 3.5, rotation: 0 },
        { itemId: 'chair-c', x: 7.5, y: 2.2, rotation: 90 },
        { itemId: 'screen', x: 9, y: 1, rotation: 90 },
        { itemId: 'cart', x: 10.3, y: 6, rotation: 0 },
        { itemId: 'mat', x: 1, y: 5, rotation: 0 },
      ],
    },
    {
      id: 'presentation',
      name: 'Presentation',
      subtitle: 'Bring everyone into the conversation.',
      color: '#7998c4',
      placements: [
        { itemId: 'screen', x: 5, y: 0.6, rotation: 0 },
        { itemId: 'table-side', x: 10, y: 1, rotation: 90 },
        { itemId: 'chair-a', x: 3, y: 3, rotation: 0 },
        { itemId: 'chair-b', x: 5, y: 3, rotation: 0 },
        { itemId: 'chair-c', x: 7, y: 3, rotation: 0 },
        { itemId: 'cart', x: 10.3, y: 6, rotation: 0 },
      ],
    },
    {
      id: 'open-floor',
      name: 'Open floor',
      subtitle: 'Clear the centre. Change the energy.',
      color: '#7b9f83',
      placements: [
        { itemId: 'mat', x: 4.5, y: 3, rotation: 0 },
        { itemId: 'screen', x: 11, y: 1, rotation: 90 },
        { itemId: 'table-main', x: 1, y: 0.6, rotation: 0 },
        { itemId: 'table-side', x: 8.5, y: 0.6, rotation: 0 },
        { itemId: 'chair-a', x: 1, y: 2.3, rotation: 0 },
        { itemId: 'chair-b', x: 2.5, y: 2.3, rotation: 0 },
        { itemId: 'cart', x: 10.3, y: 6, rotation: 0 },
      ],
    },
  ],
};
