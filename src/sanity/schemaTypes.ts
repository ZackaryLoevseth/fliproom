import { defineArrayMember, defineField, defineType } from 'sanity';

const appKey = () => defineField({
  name: 'appKey', title: 'App key', type: 'string',
  description: 'Stable identifier used by Fliproom. Keep it unique within this document type and unchanged after use.',
  validation: (rule) => rule.required().regex(/^[A-Za-z0-9_-]+$/),
});
const roomReference = () => defineField({
  name: 'room', type: 'reference', to: [{ type: 'room' }],
  validation: (rule) => rule.required(),
});
const sortOrder = () => defineField({
  name: 'sortOrder', title: 'Display order', type: 'number', initialValue: 0,
  validation: (rule) => rule.required().integer().min(0),
});

export const room = defineType({
  name: 'room', title: 'Rooms', type: 'document',
  fields: [
    appKey(),
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'width', title: 'Width (m)', type: 'number', validation: (rule) => rule.required().positive() }),
    defineField({ name: 'height', title: 'Depth (m)', type: 'number', validation: (rule) => rule.required().positive() }),
  ],
  preview: { select: { title: 'name', subtitle: 'appKey' } },
});

export const equipment = defineType({
  name: 'equipment', title: 'Equipment', type: 'document',
  fields: [
    appKey(), roomReference(), sortOrder(),
    defineField({ name: 'label', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'kind', type: 'string',
      options: { list: ['chair', 'table', 'screen', 'cart', 'mat'] },
      validation: (rule) => rule.required().custom((value) =>
        value === undefined || ['chair', 'table', 'screen', 'cart', 'mat'].includes(value) || 'Choose a supported equipment kind.'),
    }),
    defineField({ name: 'width', title: 'Width (m)', type: 'number', validation: (rule) => rule.required().positive() }),
    defineField({ name: 'height', title: 'Depth (m)', type: 'number', validation: (rule) => rule.required().positive() }),
    defineField({
      name: 'minutes', title: 'Move estimate (person-minutes)', type: 'number',
      description: 'A planning estimate entered by the room team, not a measured completion time.',
      validation: (rule) => rule.required().positive(),
    }),
  ],
  preview: { select: { title: 'label', subtitle: 'kind' } },
});

export const placement = defineType({
  name: 'placement', title: 'Equipment placement', type: 'object',
  fields: [
    defineField({
      name: 'equipment', type: 'reference', to: [{ type: 'equipment' }],
      options: {
        filter: ({ document }) => ({
          filter: 'room._ref == $roomId',
          params: { roomId: (document.room as { _ref?: string } | undefined)?._ref ?? '' },
        }),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'x', title: 'X from left (m)', type: 'number', validation: (rule) => rule.required().min(0) }),
    defineField({ name: 'y', title: 'Y from top (m)', type: 'number', validation: (rule) => rule.required().min(0) }),
    defineField({
      name: 'rotation', type: 'number', initialValue: 0,
      options: { list: [{ title: '0°', value: 0 }, { title: '90°', value: 90 }] },
      validation: (rule) => rule.required().custom((value) =>
        value === undefined || value === 0 || value === 90 || 'Rotation must be 0 or 90 degrees.'),
    }),
  ],
  preview: {
    select: { title: 'equipment.label', x: 'x', y: 'y' },
    prepare: ({ title, x, y }) => ({ title: title ?? 'Choose equipment', subtitle: `${x ?? '?'}m, ${y ?? '?'}m` }),
  },
});

export const layout = defineType({
  name: 'layout', title: 'Layouts', type: 'document',
  fields: [
    appKey(), roomReference(), sortOrder(),
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'subtitle', type: 'string', initialValue: '' }),
    defineField({
      name: 'color', title: 'Accent color', type: 'string', initialValue: '#6a7a53',
      validation: (rule) => rule.required().regex(/^#[0-9a-fA-F]{6}$/),
    }),
    defineField({
      name: 'placements', type: 'array', of: [defineArrayMember({ type: 'placement' })],
      validation: (rule) => rule.required().custom((value) => {
        if (!value) return true;
        const refs = value.map((entry) => (entry as { equipment?: { _ref?: string } }).equipment?._ref).filter(Boolean);
        return new Set(refs).size === refs.length || 'An equipment item can appear only once in a layout.';
      }),
    }),
  ],
  preview: { select: { title: 'name', subtitle: 'room.name' } },
});

export const changeoverRun = defineType({
  name: 'changeoverRun', title: 'Changeover records', type: 'document',
  description: 'Optional records entered by authenticated Studio editors. The public planner stores its checklist only in the browser.',
  fields: [
    roomReference(),
    defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'fromLayout', type: 'reference', to: [{ type: 'layout' }], validation: (rule) => rule.required() }),
    defineField({ name: 'toLayout', type: 'reference', to: [{ type: 'layout' }], validation: (rule) => rule.required() }),
    defineField({ name: 'startedAt', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'completedAt', type: 'datetime' }),
    defineField({
      name: 'completedEquipment', type: 'array',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'equipment' }] })],
      validation: (rule) => rule.unique(),
    }),
    defineField({ name: 'notes', type: 'text', rows: 3 }),
  ],
  preview: { select: { title: 'title', subtitle: 'startedAt' } },
});

export const schemaTypes = [room, equipment, placement, layout, changeoverRun];
