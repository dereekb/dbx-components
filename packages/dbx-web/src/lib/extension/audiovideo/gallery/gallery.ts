import { type Signal } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxValueListItem } from '../../../layout/list/list.view.value';
import { type DbxValueListGridItemViewGridSizeConfig } from '../../../layout/list/grid/list.grid.view.component';

/**
 * A gallery slot: an injection config, or a function that returns the injection config for an item value.
 *
 * Use a function to pick a different component per item, for example an image, color or avatar presentation by item kind.
 * Returning null/undefined leaves the slot empty for that item.
 */
export type DbxGallerySlotConfig<T> = DbxInjectionComponentConfig | ((value: T) => Maybe<DbxInjectionComponentConfig>);

/**
 * How a top or bottom slot is laid out around the presentation slot.
 *
 * - `stacked`: the slot sits outside the presentation — the top slot above it, the bottom slot below it.
 * - `overlay`: the slot is drawn over the edge of the presentation, on a scrim.
 */
export type DbxGallerySlotMode = 'stacked' | 'overlay';

/**
 * Default slot mode.
 */
export const DEFAULT_DBX_GALLERY_SLOT_MODE: DbxGallerySlotMode = 'stacked';

/**
 * Default aspect ratio of the presentation slot.
 */
export const DEFAULT_DBX_GALLERY_ASPECT_RATIO = '1 / 1';

/**
 * Default minimum width of a gallery item.
 */
export const DEFAULT_DBX_GALLERY_ITEM_MIN_WIDTH = '160px';

/**
 * Default gallery grid gap.
 */
export const DEFAULT_DBX_GALLERY_GRID_GAP = '8px';

/**
 * Configuration for a {@link DbxGalleryComponent}.
 */
export interface DbxGalleryConfig<T> {
  /**
   * Main tile content. Defaults to {@link DbxGalleryImagePresentationComponent}, which expects {@link DbxGalleryImageValue} values.
   */
  readonly presentation?: Maybe<DbxGallerySlotConfig<T>>;
  /**
   * Content above (or over the top of) the presentation, such as a label or actions.
   */
  readonly top?: Maybe<DbxGallerySlotConfig<T>>;
  /**
   * Content below (or over the bottom of) the presentation, such as actions.
   */
  readonly bottom?: Maybe<DbxGallerySlotConfig<T>>;
  /**
   * Returns the list item key for a value. Keys keep each item's components alive across list updates and identify the selected item.
   *
   * When not set, the value's `key` or `id` is used.
   */
  readonly keyForValue?: Maybe<(value: T) => Maybe<string>>;
  /**
   * Minimum CSS width of each item. Items grow to share the row width equally, and the row fits as many items as are at least
   * this wide. Defaults to {@link DEFAULT_DBX_GALLERY_ITEM_MIN_WIDTH}.
   *
   * The item height follows from the width and {@link aspectRatio}.
   */
  readonly itemMinWidth?: Maybe<string>;
  /**
   * Maximum number of columns. The row drops to fewer columns when the items would be narrower than {@link itemMinWidth}.
   *
   * Set `itemMinWidth` to `'0px'` to always show exactly this many columns. When not set, the number of columns only depends on {@link itemMinWidth}.
   */
  readonly columns?: Maybe<number>;
  /**
   * Raw grid size. `grid.columns` is a CSS `grid-template-columns` value that replaces the columns built from {@link itemMinWidth} and {@link columns}.
   *
   * The gap defaults to {@link DEFAULT_DBX_GALLERY_GRID_GAP}.
   */
  readonly grid?: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>;
  /**
   * How the top and bottom slots are laid out. Defaults to {@link DEFAULT_DBX_GALLERY_SLOT_MODE}.
   *
   * Use {@link topSlotMode} / {@link bottomSlotMode} to lay out one slot differently, for example a label over the image with actions below it.
   */
  readonly slotMode?: Maybe<DbxGallerySlotMode>;
  /**
   * How the top slot is laid out. Overrides {@link slotMode} for the top slot.
   */
  readonly topSlotMode?: Maybe<DbxGallerySlotMode>;
  /**
   * How the bottom slot is laid out. Overrides {@link slotMode} for the bottom slot.
   */
  readonly bottomSlotMode?: Maybe<DbxGallerySlotMode>;
  /**
   * CSS aspect ratio of the presentation slot. Defaults to {@link DEFAULT_DBX_GALLERY_ASPECT_RATIO}.
   */
  readonly aspectRatio?: Maybe<string>;
}

/**
 * Value shape used by {@link DbxGalleryImagePresentationComponent}.
 */
export interface DbxGalleryImageValue {
  /**
   * Full-size image url. Used for the hover preview, and for the tile when there is no thumbnail.
   */
  readonly src: string;
  /**
   * Smaller image url shown in the tile.
   */
  readonly thumbnailSrc?: Maybe<string>;
  readonly alt?: Maybe<string>;
}

/**
 * Gallery context provided by a {@link DbxGalleryComponent} to its view and items.
 */
export abstract class DbxGalleryContext<T = unknown> {
  abstract readonly galleryConfigSignal: Signal<DbxGalleryConfig<T>>;
}

/**
 * The gallery item a slot component is rendered in. Injected by {@link AbstractDbxGallerySlotDirective}.
 */
export abstract class DbxGalleryItem<T = unknown> {
  abstract readonly itemSignal: Signal<DbxValueListItem<T>>;
  abstract readonly valueSignal: Signal<T>;
  abstract readonly selectedSignal: Signal<boolean>;
}

/**
 * Input for {@link dbxGalleryGridColumns}.
 */
export interface DbxGalleryGridColumnsInput {
  /**
   * Minimum CSS width of each item. Defaults to {@link DEFAULT_DBX_GALLERY_ITEM_MIN_WIDTH}.
   */
  readonly itemMinWidth?: Maybe<string>;
  /**
   * Maximum number of columns. Ignored when null/undefined or less than 1.
   */
  readonly columns?: Maybe<number>;
  /**
   * CSS gap between columns. Used to size the columns when {@link columns} is set. Defaults to {@link DEFAULT_DBX_GALLERY_GRID_GAP}.
   */
  readonly gap?: Maybe<string>;
}

/**
 * Returns the CSS `grid-template-columns` value for a gallery: as many columns as fit at {@link DbxGalleryGridColumnsInput.itemMinWidth},
 * capped at {@link DbxGalleryGridColumnsInput.columns} when set.
 *
 * @param input - The item min width, max columns and gap.
 * @returns The `grid-template-columns` value.
 *
 * @example
 * ```ts
 * dbxGalleryGridColumns({}); // 'repeat(auto-fill, minmax(160px, 1fr))'
 * dbxGalleryGridColumns({ itemMinWidth: '100px', columns: 4, gap: '8px' }); // 'repeat(auto-fill, minmax(max(100px, calc((100% - 3 * 8px) / 4)), 1fr))'
 * ```
 */
export function dbxGalleryGridColumns(input: DbxGalleryGridColumnsInput): string {
  const { columns, itemMinWidth, gap } = input;
  let minWidth = itemMinWidth ?? DEFAULT_DBX_GALLERY_ITEM_MIN_WIDTH;

  // a column is never narrower than 1/columns of the row, so no more than that many columns fit
  if (columns != null && columns >= 1) {
    const count = Math.floor(columns);
    minWidth = `max(${minWidth}, calc((100% - ${count - 1} * ${gap ?? DEFAULT_DBX_GALLERY_GRID_GAP}) / ${count}))`;
  }

  return `repeat(auto-fill, minmax(${minWidth}, 1fr))`;
}

/**
 * Returns the injection config of a slot for a value.
 *
 * @param slot - The slot config.
 * @param value - The item value.
 * @returns The injection config, if any.
 */
export function dbxGallerySlotInjectionConfig<T>(slot: Maybe<DbxGallerySlotConfig<T>>, value: T): Maybe<DbxInjectionComponentConfig> {
  return typeof slot === 'function' ? slot(value) : slot;
}

/**
 * Whether two slot injection configs would render the same component with the same data.
 *
 * Compares `data` shallowly, so a slot function that builds a new data object for each call does not re-create the component.
 *
 * @param a - The first config.
 * @param b - The second config.
 * @returns True if the configs are the same.
 */
export function isSameDbxGallerySlotInjectionConfig(a: Maybe<DbxInjectionComponentConfig>, b: Maybe<DbxInjectionComponentConfig>): boolean {
  let result: boolean;

  if (a == null || b == null) {
    result = a === b;
  } else if (a === b) {
    result = true;
  } else {
    result = a.componentClass === b.componentClass && a.init === b.init && a.injector === b.injector && a.providers === b.providers && isShallowEqualObject(a.data, b.data);
  }

  return result;
}

function isShallowEqualObject(a: unknown, b: unknown): boolean {
  let result = a === b;

  if (!result && a != null && b != null && typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    result = aKeys.length === Object.keys(bRecord).length && aKeys.every((key) => aRecord[key] === bRecord[key]);
  }

  return result;
}
