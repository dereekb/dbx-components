import { describe, it, expect } from 'vitest';
import { type DbxLayoutBox, type DbxLayoutBoxesValue, DEFAULT_DBX_LAYOUT_BOX_NEW_BOX, DBX_LAYOUT_BOX_MIN_SIDE } from './layoutboxes';
import { addDbxLayoutBoxItem, boundDbxLayoutBox, countDbxLayoutBoxItems, dbxLayoutBoxesCanvasAspectRatio, isSameDbxLayoutBox, moveDbxLayoutBox, nudgeDbxLayoutBox, removeDbxLayoutBoxItem, resizeDbxLayoutBox, updateDbxLayoutBoxItemBox, updateDbxLayoutBoxItemData } from './layoutboxes.geometry';

interface TestData {
  readonly kind: 'person' | 'thing';
  readonly label?: string;
}

const BOX: DbxLayoutBox = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

function makeItems(): DbxLayoutBoxesValue<TestData> {
  return [
    { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 }, data: { kind: 'person', label: 'A' } },
    { box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, data: { kind: 'thing' } },
    { box: { x: 0.6, y: 0.1, w: 0.2, h: 0.5 }, data: { kind: 'person' } }
  ];
}

describe('boundDbxLayoutBox()', () => {
  it('should cap the extent at the canvas edge', () => {
    expect(boundDbxLayoutBox({ x: 0.5, y: 0.5, w: 0.9, h: 0.9 })).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });

  it('should clamp the corner to the canvas', () => {
    expect(boundDbxLayoutBox({ x: -0.5, y: 2, w: 0.5, h: 0.5 })).toBeUndefined();
    expect(boundDbxLayoutBox({ x: -0.5, y: 0.2, w: 0.5, h: 0.5 })).toEqual({ x: 0, y: 0.2, w: 0.5, h: 0.5 });
  });

  it('should round each value to 4 decimals', () => {
    expect(boundDbxLayoutBox({ x: 0.123456, y: 0.1, w: 0.2, h: 0.2 })?.x).toBe(0.1235);
  });

  it('should return undefined for a zero-area box', () => {
    expect(boundDbxLayoutBox({ x: 0.5, y: 0.5, w: 0, h: 0.2 })).toBeUndefined();
  });

  it('should return undefined for a non-finite value', () => {
    expect(boundDbxLayoutBox({ x: Number.NaN, y: 0.5, w: 0.2, h: 0.2 })).toBeUndefined();
    expect(boundDbxLayoutBox({ x: 0.1, y: 0.5, w: Number.POSITIVE_INFINITY, h: 0.2 })).toBeUndefined();
  });

  it('should return undefined for a missing box', () => {
    expect(boundDbxLayoutBox(undefined)).toBeUndefined();
  });
});

describe('isSameDbxLayoutBox()', () => {
  it('should return true when all four values are equal', () => {
    expect(isSameDbxLayoutBox(BOX, { ...BOX })).toBe(true);
  });

  it('should return false when any value differs', () => {
    expect(isSameDbxLayoutBox(BOX, { ...BOX, h: 0.41 })).toBe(false);
  });

  it('should return false when one box is missing', () => {
    expect(isSameDbxLayoutBox(BOX, undefined)).toBe(false);
  });
});

describe('moveDbxLayoutBox()', () => {
  it('should move the box and keep its size', () => {
    expect(moveDbxLayoutBox(BOX, { x: 0.1, y: -0.05 })).toEqual({ x: 0.3, y: 0.15, w: 0.4, h: 0.4 });
  });

  it('should keep the box on the canvas', () => {
    expect(moveDbxLayoutBox(BOX, { x: 5, y: -5 })).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.4 });
  });
});

describe('resizeDbxLayoutBox()', () => {
  it('should grow from the se corner', () => {
    expect(resizeDbxLayoutBox(BOX, { corner: 'se', delta: { x: 0.1, y: 0.2 } })).toEqual({ x: 0.2, y: 0.2, w: 0.5, h: 0.6 });
  });

  it('should shrink from the nw corner while the se corner stays fixed', () => {
    expect(resizeDbxLayoutBox(BOX, { corner: 'nw', delta: { x: 0.1, y: 0.1 } })).toEqual({ x: 0.3, y: 0.3, w: 0.3, h: 0.3 });
  });

  it('should not flip the box past the opposite corner', () => {
    const result = resizeDbxLayoutBox(BOX, { corner: 'nw', delta: { x: 1, y: 1 } });
    expect(result.w).toBe(DBX_LAYOUT_BOX_MIN_SIDE);
    expect(result.h).toBe(DBX_LAYOUT_BOX_MIN_SIDE);
    expect(result.x + result.w).toBeCloseTo(0.6, 10);
    expect(result.y + result.h).toBeCloseTo(0.6, 10);
  });

  it('should keep the ne corner on the canvas', () => {
    expect(resizeDbxLayoutBox(BOX, { corner: 'ne', delta: { x: 2, y: -2 } })).toEqual({ x: 0.2, y: 0, w: 0.8, h: 0.6 });
  });

  it('should keep the sw corner on the canvas', () => {
    expect(resizeDbxLayoutBox(BOX, { corner: 'sw', delta: { x: -2, y: 2 } })).toEqual({ x: 0, y: 0.2, w: 0.6, h: 0.8 });
  });
});

describe('nudgeDbxLayoutBox()', () => {
  it('should move right by 0.01 on ArrowRight', () => {
    expect(nudgeDbxLayoutBox(BOX, { key: 'ArrowRight' })?.x).toBe(0.21);
  });

  it('should move up by 0.05 on Shift+ArrowUp', () => {
    expect(nudgeDbxLayoutBox(BOX, { key: 'ArrowUp', shiftKey: true })?.y).toBe(0.15);
  });

  it('should grow the height on Alt+ArrowDown', () => {
    const result = nudgeDbxLayoutBox(BOX, { key: 'ArrowDown', altKey: true });
    expect(result).toEqual({ x: 0.2, y: 0.2, w: 0.4, h: 0.41 });
  });

  it('should return undefined for a key that is not an arrow key', () => {
    expect(nudgeDbxLayoutBox(BOX, { key: 'Enter' })).toBeUndefined();
  });
});

describe('dbxLayoutBoxesCanvasAspectRatio()', () => {
  it('should return width / height', () => {
    expect(dbxLayoutBoxesCanvasAspectRatio({ width: 16, height: 9 })).toBe(16 / 9);
  });

  it('should return 1 for an invalid size', () => {
    expect(dbxLayoutBoxesCanvasAspectRatio({ width: 0, height: 9 })).toBe(1);
    expect(dbxLayoutBoxesCanvasAspectRatio({ width: -16, height: 9 })).toBe(1);
    expect(dbxLayoutBoxesCanvasAspectRatio({ width: Number.NaN, height: 9 })).toBe(1);
    expect(dbxLayoutBoxesCanvasAspectRatio(undefined)).toBe(1);
  });
});

describe('updateDbxLayoutBoxItemBox()', () => {
  it('should bound the new box and keep the other items', () => {
    const items = makeItems();
    const result = updateDbxLayoutBoxItemBox(items, { index: 1, box: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } });
    expect(result).not.toBe(items);
    expect(result[1].box).toEqual({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 });
    expect(result[1].data).toBe(items[1].data);
    expect(result[0]).toBe(items[0]);
    expect(result[2]).toBe(items[2]);
    expect(items[1].box).toEqual({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
  });

  it('should keep the current box when the new box is invalid', () => {
    const items = makeItems();
    const result = updateDbxLayoutBoxItemBox(items, { index: 1, box: { x: 0.5, y: 0.5, w: 0, h: 0 } });
    expect(result[1].box).toBe(items[1].box);
  });

  it('should return the same array for an out-of-range index', () => {
    const items = makeItems();
    expect(updateDbxLayoutBoxItemBox(items, { index: 3, box: BOX })).toBe(items);
    expect(updateDbxLayoutBoxItemBox(items, { index: -1, box: BOX })).toBe(items);
  });
});

describe('updateDbxLayoutBoxItemData()', () => {
  it('should replace the item data', () => {
    const items = makeItems();
    const result = updateDbxLayoutBoxItemData(items, { index: 1, data: { kind: 'thing', label: 'Door' } });
    expect(result[1].data).toEqual({ kind: 'thing', label: 'Door' });
    expect(result[1].box).toBe(items[1].box);
    expect(result[0]).toBe(items[0]);
  });

  it('should return the same array for an out-of-range index', () => {
    const items = makeItems();
    expect(updateDbxLayoutBoxItemData(items, { index: 5, data: { kind: 'thing' } })).toBe(items);
  });
});

describe('addDbxLayoutBoxItem()', () => {
  it('should append the item with a bounded box', () => {
    const items = makeItems();
    const result = addDbxLayoutBoxItem(items, { box: { x: 0.8, y: 0.8, w: 0.5, h: 0.5 }, data: { kind: 'thing' } });
    expect(result.length).toBe(4);
    expect(items.length).toBe(3);
    expect(result[3]).toEqual({ box: { x: 0.8, y: 0.8, w: 0.2, h: 0.2 }, data: { kind: 'thing' } });
  });

  it('should use the default new box for an invalid box', () => {
    const result = addDbxLayoutBoxItem<TestData>([], { box: { x: 0, y: 0, w: 0, h: 0 }, data: { kind: 'thing' } });
    expect(result[0].box).toEqual(DEFAULT_DBX_LAYOUT_BOX_NEW_BOX);
  });
});

describe('removeDbxLayoutBoxItem()', () => {
  it('should remove the item', () => {
    const items = makeItems();
    const result = removeDbxLayoutBoxItem(items, 1);
    expect(result).toEqual([items[0], items[2]]);
    expect(items.length).toBe(3);
  });

  it('should return the same array for an out-of-range index', () => {
    const items = makeItems();
    expect(removeDbxLayoutBoxItem(items, 3)).toBe(items);
    expect(removeDbxLayoutBoxItem(items, -1)).toBe(items);
  });
});

describe('countDbxLayoutBoxItems()', () => {
  it('should count every item without a filter', () => {
    expect(countDbxLayoutBoxItems(makeItems())).toBe(3);
  });

  it('should count only the items that pass the filter', () => {
    expect(countDbxLayoutBoxItems(makeItems(), (item) => item.data.kind === 'person')).toBe(2);
  });

  it('should return 0 for missing items', () => {
    expect(countDbxLayoutBoxItems(undefined)).toBe(0);
    expect(countDbxLayoutBoxItems(null)).toBe(0);
  });
});
