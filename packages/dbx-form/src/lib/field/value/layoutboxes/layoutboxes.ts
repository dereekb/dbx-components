import { type CssClassesArray, type FilterFunction, type Getter, type Maybe, type PercentDecimal } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type DbxColorInput } from '@dereekb/dbx-web';

// MARK: Value
/**
 * A normalized rectangle: fractions of the canvas, measured from its top-left corner.
 *
 * Every value is a fraction of the canvas (0..1), so a box keeps its place whatever size the canvas is drawn at.
 */
export interface DbxLayoutBox {
  /**
   * The left edge, as a fraction of the canvas width.
   */
  readonly x: PercentDecimal;
  /**
   * The top edge, as a fraction of the canvas height.
   */
  readonly y: PercentDecimal;
  /**
   * The width, as a fraction of the canvas width.
   */
  readonly w: PercentDecimal;
  /**
   * The height, as a fraction of the canvas height.
   */
  readonly h: PercentDecimal;
}

/**
 * One box in a layout: where it is, and the consumer's payload for it.
 */
export interface DbxLayoutBoxItem<T = unknown> {
  readonly box: DbxLayoutBox;
  readonly data: T;
}

/**
 * The layout boxes value: boxes in display order. Box N is the item at index N - 1.
 */
export type DbxLayoutBoxesValue<T = unknown> = DbxLayoutBoxItem<T>[];

/**
 * The canvas the boxes are drawn on. Only its aspect ratio matters, in any unit.
 */
export interface DbxLayoutBoxesCanvasSize {
  readonly width: number;
  readonly height: number;
}

/**
 * A box corner a resize drags. The opposite corner stays fixed.
 */
export type DbxLayoutBoxCorner = 'nw' | 'ne' | 'sw' | 'se';

/**
 * Every box corner, in the order the resize handles are drawn.
 */
export const DBX_LAYOUT_BOX_CORNERS: readonly DbxLayoutBoxCorner[] = ['nw', 'ne', 'sw', 'se'];

/**
 * The smallest side a resize leaves on a box, as a fraction of the canvas.
 */
export const DBX_LAYOUT_BOX_MIN_SIDE: PercentDecimal = 0.02;

/**
 * The arrow-key nudge step, as a fraction of the canvas.
 */
export const DBX_LAYOUT_BOX_NUDGE_STEP: PercentDecimal = 0.01;

/**
 * The arrow-key nudge step while Shift is held, as a fraction of the canvas.
 */
export const DBX_LAYOUT_BOX_NUDGE_SHIFT_STEP: PercentDecimal = 0.05;

/**
 * The number of decimals each box value is rounded to.
 */
export const DBX_LAYOUT_BOX_PRECISION = 4;

/**
 * The box a newly added item starts with when its add option gives none.
 */
export const DEFAULT_DBX_LAYOUT_BOX_NEW_BOX: DbxLayoutBox = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 };

/**
 * The canvas used when none is configured: a square.
 */
export const DEFAULT_DBX_LAYOUT_BOXES_CANVAS_SIZE: DbxLayoutBoxesCanvasSize = { width: 1, height: 1 };

// MARK: Presentation
/**
 * How one box, and its row in the box list, is styled.
 */
export interface DbxLayoutBoxesItemStyle {
  /**
   * CSS classes applied to the box and to its row.
   *
   * A class can set `--dbx-layout-boxes-box-color` to give the box a custom tone.
   */
  readonly cssClasses?: Maybe<CssClassesArray>;
  /**
   * The color given to `[dbxColor]` on the box and to `[color]` on the row's number chip.
   */
  readonly color?: Maybe<DbxColorInput>;
}

/**
 * Returns the style for one box. Called once per box each time the value changes.
 */
export type DbxLayoutBoxesItemStyleFunction<T = unknown> = (item: DbxLayoutBoxItem<T>, index: number) => Maybe<DbxLayoutBoxesItemStyle>;

/**
 * Returns the row component config for one box, or nothing to show `Box N` for it.
 *
 * Called once per box each time the value changes. Return stable references (such as module constants): a row keeps
 * its component while the returned reference stays the same, and is rebuilt when it changes.
 */
export type DbxLayoutBoxesItemConfigFunction<T = unknown> = (item: DbxLayoutBoxItem<T>, index: number) => Maybe<DbxInjectionComponentConfig>;

/**
 * The row component for the box list: one config for every row, or a {@link DbxLayoutBoxesItemConfigFunction} that
 * picks a config per box.
 */
export type DbxLayoutBoxesItemConfig<T = unknown> = DbxInjectionComponentConfig | DbxLayoutBoxesItemConfigFunction<T>;

/**
 * One "add a box" button.
 */
export interface DbxLayoutBoxesAddOption<T = unknown> {
  /**
   * The button text.
   */
  readonly text: string;
  /**
   * The button icon.
   */
  readonly icon?: Maybe<string>;
  /**
   * The box the new item starts with. Defaults to {@link DEFAULT_DBX_LAYOUT_BOX_NEW_BOX}.
   */
  readonly box?: Maybe<DbxLayoutBox>;
  /**
   * Builds a fresh payload for each added box.
   */
  readonly data: Getter<T>;
}

/**
 * Returns the cap warning text for the current count.
 */
export type DbxLayoutBoxesCapWarningFunction = (count: number, max: number) => string;

/**
 * A soft limit on the number of boxes. Passing it shows a warning, but adding is never blocked.
 *
 * Use the forge `maxLength` validator for a hard limit.
 */
export interface DbxLayoutBoxesCapConfig<T = unknown> {
  /**
   * The most boxes that count toward the cap before the warning shows.
   */
  readonly max: number;
  /**
   * Which boxes count toward the cap. Every box counts by default.
   */
  readonly countFilter?: Maybe<FilterFunction<DbxLayoutBoxItem<T>>>;
  /**
   * The warning text. Defaults to `${count} boxes: past the limit of ${max}.`
   */
  readonly warning?: Maybe<string | DbxLayoutBoxesCapWarningFunction>;
}

/**
 * Where the box list is drawn relative to the canvas.
 *
 * - `'side'`: beside the canvas, wrapping below it when there is not enough room.
 * - `'below'`: always below the canvas.
 */
export type DbxLayoutBoxesListPosition = 'side' | 'below';

/**
 * The default cap warning text.
 *
 * @param count - The number of boxes that count toward the cap.
 * @param max - The cap.
 * @returns The warning text.
 *
 * @example
 * ```ts
 * defaultDbxLayoutBoxesCapWarning(3, 2); // '3 boxes: past the limit of 2.'
 * ```
 */
export function defaultDbxLayoutBoxesCapWarning(count: number, max: number): string {
  return `${count} boxes: past the limit of ${max}.`;
}
