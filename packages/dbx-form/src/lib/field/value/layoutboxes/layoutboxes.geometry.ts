import { type FilterFunction, type Maybe, type Vector, boundNumber, roundToPrecision } from '@dereekb/util';
import { type DbxLayoutBox, type DbxLayoutBoxCorner, type DbxLayoutBoxItem, type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesValue, DEFAULT_DBX_LAYOUT_BOX_NEW_BOX, DBX_LAYOUT_BOX_MIN_SIDE, DBX_LAYOUT_BOX_NUDGE_SHIFT_STEP, DBX_LAYOUT_BOX_NUDGE_STEP, DBX_LAYOUT_BOX_PRECISION } from './layoutboxes';

/*
 * The layout boxes geometry: pure functions over boxes and box lists. The layout boxes components call these and
 * nothing else changes a layout.
 *
 * Boxes are fractions of the canvas from its top left. Deltas are fractions too (a pointer delta divided by the canvas
 * size on screen), so the geometry never deals with pixels.
 */

// MARK: Box
/**
 * Bounds a box to the canvas.
 *
 * - The corner is clamped to [0, 1].
 * - The width is at most 1 - x, and the height at most 1 - y.
 * - Each value is rounded to {@link DBX_LAYOUT_BOX_PRECISION} decimals.
 *
 * @param box - The box to bound.
 * @returns The bounded box, or `undefined` when a value is not a finite number or the bounded box has no area.
 *
 * @example
 * ```ts
 * boundDbxLayoutBox({ x: 0.5, y: 0.5, w: 0.9, h: 0.9 }); // { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
 * boundDbxLayoutBox({ x: 0.5, y: 0.5, w: 0, h: 0.2 }); // undefined
 * ```
 */
export function boundDbxLayoutBox(box: Maybe<DbxLayoutBox>): Maybe<DbxLayoutBox> {
  let result: Maybe<DbxLayoutBox>;

  if (box != null && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.w) && Number.isFinite(box.h)) {
    const x = roundToPrecision(boundNumber(box.x, 0, 1), DBX_LAYOUT_BOX_PRECISION);
    const y = roundToPrecision(boundNumber(box.y, 0, 1), DBX_LAYOUT_BOX_PRECISION);
    const w = roundToPrecision(boundNumber(box.w, 0, 1 - x), DBX_LAYOUT_BOX_PRECISION);
    const h = roundToPrecision(boundNumber(box.h, 0, 1 - y), DBX_LAYOUT_BOX_PRECISION);

    if (w > 0 && h > 0) {
      result = { x, y, w, h };
    }
  }

  return result;
}

/**
 * Returns true when both boxes have the same four values.
 *
 * @param a - The first box.
 * @param b - The second box.
 * @returns Whether the boxes are the same.
 *
 * @example
 * ```ts
 * isSameDbxLayoutBox({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }); // true
 * ```
 */
export function isSameDbxLayoutBox(a: Maybe<DbxLayoutBox>, b: Maybe<DbxLayoutBox>): boolean {
  return a != null && b != null ? a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h : a === b;
}

/**
 * Moves a box by a fractional delta. Its size is kept, and it stays on the canvas.
 *
 * @param box - The box to move.
 * @param delta - The move, as fractions of the canvas width (x) and height (y).
 * @returns The moved box, or the input box when the move gives an invalid box.
 *
 * @example
 * ```ts
 * moveDbxLayoutBox({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, { x: 0.1, y: -0.05 }); // { x: 0.3, y: 0.15, w: 0.4, h: 0.4 }
 * ```
 */
export function moveDbxLayoutBox(box: DbxLayoutBox, delta: Vector): DbxLayoutBox {
  const x = boundNumber(box.x + delta.x, 0, Math.max(0, 1 - box.w));
  const y = boundNumber(box.y + delta.y, 0, Math.max(0, 1 - box.h));
  return boundDbxLayoutBox({ x, y, w: box.w, h: box.h }) ?? box;
}

/**
 * Input for {@link resizeDbxLayoutBox}.
 */
export interface ResizeDbxLayoutBoxParams {
  /**
   * The corner being dragged. The opposite corner stays fixed.
   */
  readonly corner: DbxLayoutBoxCorner;
  /**
   * The drag, as fractions of the canvas width (x) and height (y).
   */
  readonly delta: Vector;
}

/**
 * Resizes a box by dragging one corner.
 *
 * The opposite corner stays fixed. The box never flips past it, never shrinks below {@link DBX_LAYOUT_BOX_MIN_SIDE},
 * and the dragged corner stays on the canvas.
 *
 * @param box - The box to resize.
 * @param params - The corner and the drag.
 * @returns The resized box, or the input box when the resize gives an invalid box.
 *
 * @example
 * ```ts
 * resizeDbxLayoutBox({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, { corner: 'se', delta: { x: 0.1, y: 0.2 } }); // { x: 0.2, y: 0.2, w: 0.5, h: 0.6 }
 * ```
 */
export function resizeDbxLayoutBox(box: DbxLayoutBox, params: ResizeDbxLayoutBoxParams): DbxLayoutBox {
  const { corner, delta } = params;
  const min = DBX_LAYOUT_BOX_MIN_SIDE;
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;

  if (corner === 'nw' || corner === 'sw') {
    left = Math.min(Math.max(left + delta.x, 0), right - min);
  } else {
    right = Math.max(Math.min(right + delta.x, 1), left + min);
  }

  if (corner === 'nw' || corner === 'ne') {
    top = Math.min(Math.max(top + delta.y, 0), bottom - min);
  } else {
    bottom = Math.max(Math.min(bottom + delta.y, 1), top + min);
  }

  return boundDbxLayoutBox({ x: left, y: top, w: right - left, h: bottom - top }) ?? box;
}

/**
 * The key input for {@link nudgeDbxLayoutBox}. A `KeyboardEvent` matches it, so the event can be passed in directly.
 */
export interface NudgeDbxLayoutBoxParams {
  /**
   * The `KeyboardEvent.key`. Only the arrow keys nudge.
   */
  readonly key: string;
  /**
   * Steps by {@link DBX_LAYOUT_BOX_NUDGE_SHIFT_STEP} instead of {@link DBX_LAYOUT_BOX_NUDGE_STEP}.
   */
  readonly shiftKey?: Maybe<boolean>;
  /**
   * Resizes from the bottom-right corner instead of moving.
   */
  readonly altKey?: Maybe<boolean>;
}

/**
 * Nudges a box with an arrow key.
 *
 * Each press moves the box {@link DBX_LAYOUT_BOX_NUDGE_STEP}, or {@link DBX_LAYOUT_BOX_NUDGE_SHIFT_STEP} with Shift. With
 * Alt, the box is resized from its bottom-right corner instead.
 *
 * @param box - The box to nudge.
 * @param params - The key and its modifiers. A `KeyboardEvent` can be passed in directly.
 * @returns The nudged box, or `undefined` when the key is not an arrow key.
 *
 * @example
 * ```ts
 * nudgeDbxLayoutBox({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, { key: 'ArrowRight' }); // { x: 0.21, y: 0.2, w: 0.4, h: 0.4 }
 * nudgeDbxLayoutBox(box, { key: 'Enter' }); // undefined
 * ```
 */
export function nudgeDbxLayoutBox(box: DbxLayoutBox, params: NudgeDbxLayoutBoxParams): Maybe<DbxLayoutBox> {
  const step = params.shiftKey === true ? DBX_LAYOUT_BOX_NUDGE_SHIFT_STEP : DBX_LAYOUT_BOX_NUDGE_STEP;
  let delta: Maybe<Vector>;

  switch (params.key) {
    case 'ArrowLeft':
      delta = { x: -step, y: 0 };
      break;
    case 'ArrowRight':
      delta = { x: step, y: 0 };
      break;
    case 'ArrowUp':
      delta = { x: 0, y: -step };
      break;
    case 'ArrowDown':
      delta = { x: 0, y: step };
      break;
    default:
      delta = undefined;
      break;
  }

  let result: Maybe<DbxLayoutBox>;

  if (delta != null) {
    result = params.altKey === true ? resizeDbxLayoutBox(box, { corner: 'se', delta }) : moveDbxLayoutBox(box, delta);
  }

  return result;
}

/**
 * Returns the aspect ratio (width / height) of a canvas.
 *
 * @param canvas - The canvas size.
 * @returns The aspect ratio, or 1 when the size is missing, not positive or not finite.
 *
 * @example
 * ```ts
 * dbxLayoutBoxesCanvasAspectRatio({ width: 16, height: 9 }); // 1.777...
 * dbxLayoutBoxesCanvasAspectRatio({ width: 0, height: 9 }); // 1
 * ```
 */
export function dbxLayoutBoxesCanvasAspectRatio(canvas: Maybe<DbxLayoutBoxesCanvasSize>): number {
  const width = canvas?.width ?? 0;
  const height = canvas?.height ?? 0;
  const isValid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  return isValid ? width / height : 1;
}

// MARK: Items
/**
 * Input for {@link updateDbxLayoutBoxItemBox}.
 */
export interface UpdateDbxLayoutBoxItemBoxParams {
  /**
   * The index of the item to update.
   */
  readonly index: number;
  /**
   * The item's new box. It is bounded to the canvas.
   */
  readonly box: DbxLayoutBox;
}

/**
 * Gives one item a new box.
 *
 * Returns a new array and leaves the input unchanged. The other items keep their references.
 *
 * @param items - The current items.
 * @param params - The item index and its new box. An invalid box keeps the item's current box.
 * @returns The updated items, or the same array when the index is out of range.
 *
 * @example
 * ```ts
 * const next = updateDbxLayoutBoxItemBox(items, { index: 0, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
 * ```
 */
export function updateDbxLayoutBoxItemBox<T>(items: DbxLayoutBoxesValue<T>, params: UpdateDbxLayoutBoxItemBoxParams): DbxLayoutBoxesValue<T> {
  const { index, box } = params;
  const item = items[index];
  return item == null ? items : items.map((existing, i) => (i === index ? { ...existing, box: boundDbxLayoutBox(box) ?? existing.box } : existing));
}

/**
 * Input for {@link updateDbxLayoutBoxItemData}.
 */
export interface UpdateDbxLayoutBoxItemDataParams<T> {
  /**
   * The index of the item to update.
   */
  readonly index: number;
  /**
   * The item's new payload.
   */
  readonly data: T;
}

/**
 * Gives one item a new payload.
 *
 * Returns a new array and leaves the input unchanged. The other items keep their references.
 *
 * @param items - The current items.
 * @param params - The item index and its new payload.
 * @returns The updated items, or the same array when the index is out of range.
 *
 * @example
 * ```ts
 * const next = updateDbxLayoutBoxItemData(items, { index: 1, data: { label: 'Door' } });
 * ```
 */
export function updateDbxLayoutBoxItemData<T>(items: DbxLayoutBoxesValue<T>, params: UpdateDbxLayoutBoxItemDataParams<T>): DbxLayoutBoxesValue<T> {
  const { index, data } = params;
  const item = items[index];
  return item == null ? items : items.map((existing, i) => (i === index ? { ...existing, data } : existing));
}

/**
 * Appends an item.
 *
 * Returns a new array and leaves the input unchanged. The new item's box is bounded to the canvas, and an invalid box
 * becomes {@link DEFAULT_DBX_LAYOUT_BOX_NEW_BOX}.
 *
 * @param items - The current items.
 * @param item - The item to add.
 * @returns The items with the new item at the end.
 *
 * @example
 * ```ts
 * const next = addDbxLayoutBoxItem(items, { box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, data: { kind: 'thing' } });
 * ```
 */
export function addDbxLayoutBoxItem<T>(items: DbxLayoutBoxesValue<T>, item: DbxLayoutBoxItem<T>): DbxLayoutBoxesValue<T> {
  return [...items, { ...item, box: boundDbxLayoutBox(item.box) ?? DEFAULT_DBX_LAYOUT_BOX_NEW_BOX }];
}

/**
 * Removes one item.
 *
 * Returns a new array and leaves the input unchanged.
 *
 * @param items - The current items.
 * @param index - The index of the item to remove.
 * @returns The items without the removed item, or the same array when the index is out of range.
 *
 * @example
 * ```ts
 * const next = removeDbxLayoutBoxItem(items, 0);
 * ```
 */
export function removeDbxLayoutBoxItem<T>(items: DbxLayoutBoxesValue<T>, index: number): DbxLayoutBoxesValue<T> {
  return index < 0 || index >= items.length ? items : items.filter((_, i) => i !== index);
}

/**
 * Counts the items, optionally only those that pass a filter.
 *
 * @param items - The items to count.
 * @param filter - Which items count. Every item counts when omitted.
 * @returns The count, or 0 when there are no items.
 *
 * @example
 * ```ts
 * countDbxLayoutBoxItems(items, (item) => item.data.kind === 'person');
 * ```
 */
export function countDbxLayoutBoxItems<T>(items: Maybe<DbxLayoutBoxesValue<T>>, filter?: Maybe<FilterFunction<DbxLayoutBoxItem<T>>>): number {
  let count = 0;

  if (items != null) {
    count = filter == null ? items.length : items.filter(filter).length;
  }

  return count;
}
