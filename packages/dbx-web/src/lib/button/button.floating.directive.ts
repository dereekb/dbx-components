import { computed, Directive, input } from '@angular/core';
import { type CssTokenVar, type Maybe, type Pixels, type PixelsString } from '@dereekb/util';

/**
 * How a {@link DbxButtonFloatingDirective} host floats.
 *
 * - `'sticky'`: pinned to the edge of its scroll container while its parent section is on screen, then rests at the end of that section.
 * - `'fixed'`: pinned to the viewport, like a classic floating action button.
 */
export type DbxButtonFloatingMode = 'sticky' | 'fixed';

/**
 * Edge and alignment a {@link DbxButtonFloatingDirective} host floats to.
 */
export type DbxButtonFloatingPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'top-center';

/**
 * Horizontal alignment portion of a {@link DbxButtonFloatingPosition}.
 */
export type DbxButtonFloatingHorizontalAlignment = 'left' | 'center' | 'right';

/**
 * Distance between a floating button and the edge it is pinned to. Numbers are treated as pixels.
 */
export type DbxButtonFloatingOffset = Pixels | PixelsString | CssTokenVar;

/**
 * Configuration for a {@link DbxButtonFloatingDirective}.
 */
export interface DbxButtonFloatingConfig {
  /**
   * How the host floats. Defaults to `'sticky'`.
   */
  readonly mode?: Maybe<DbxButtonFloatingMode>;
  /**
   * Edge and alignment the host floats to. Defaults to `'bottom-right'`.
   */
  readonly position?: Maybe<DbxButtonFloatingPosition>;
  /**
   * Offset applied to both axes. Defaults to the `--dbx-button-floating-offset` token (`padding-4`).
   */
  readonly offset?: Maybe<DbxButtonFloatingOffset>;
  /**
   * Horizontal offset. Takes priority over {@link offset}. Only applies in `'fixed'` mode.
   */
  readonly offsetX?: Maybe<DbxButtonFloatingOffset>;
  /**
   * Vertical offset. Takes priority over {@link offset}.
   */
  readonly offsetY?: Maybe<DbxButtonFloatingOffset>;
}

/**
 * Default {@link DbxButtonFloatingPosition} for a {@link DbxButtonFloatingDirective}.
 */
export const DEFAULT_DBX_BUTTON_FLOATING_POSITION: DbxButtonFloatingPosition = 'bottom-right';

/**
 * Floats its host — typically a `dbx-button` with `dbxActionButton`, or a wrapper holding several buttons — over the content
 * by applying the `.dbx-button-floating` utility classes.
 *
 * In the default `'sticky'` mode the host stays pinned to the edge of its scroll container while its parent section is on
 * screen, which suits a Save button at the end of a long form. Place the host at the end of its section for bottom positions and
 * at the start for top positions. Sticky stops working when an ancestor between the host and the scroll container sets
 * `overflow`. In `'fixed'` mode the host is pinned to the viewport; fixed positioning is re-anchored to any ancestor that sets
 * `transform`, `filter` or `contain`.
 *
 * Set `fab` on the `dbx-button` for the Material FAB presentation (an extended FAB when it has text). Pair with
 * `dbxActionEnforceModified` on the action to keep a floating Save button disabled until the form has changes.
 *
 * @dbxWebComponent
 * @dbxWebSlug button-floating
 * @dbxWebCategory button
 * @dbxWebRelated button, button-spacer, content-pit
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-button dbxButtonFloating fab color="primary" icon="save" text="Save" dbxActionButton></dbx-button>
 * ```
 *
 * @example
 * ```html
 * <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleSave">
 *   <my-form dbxActionForm></my-form>
 *   <dbx-button dbxButtonFloating fab color="primary" icon="save" text="Save" dbxActionButton></dbx-button>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <dbx-button dbxButtonFloating="top-left" dbxButtonFloatingMode="fixed" [dbxButtonFloatingOffset]="24" fab icon="add" text="New"></dbx-button>
 * ```
 */
@Directive({
  selector: '[dbxButtonFloating]',
  host: {
    class: 'dbx-button-floating',
    '[class.dbx-button-floating-fixed]': 'isFixedSignal()',
    '[class.dbx-button-floating-top]': 'isTopSignal()',
    '[class.dbx-button-floating-left]': "horizontalAlignmentSignal() === 'left'",
    '[class.dbx-button-floating-center]': "horizontalAlignmentSignal() === 'center'",
    '[style.--dbx-button-floating-offset-x]': 'offsetXSignal()',
    '[style.--dbx-button-floating-offset-y]': 'offsetYSignal()'
  }
})
export class DbxButtonFloatingDirective {
  /**
   * Config for the floating button, or a {@link DbxButtonFloatingPosition} shorthand. Empty when used as a bare attribute.
   */
  readonly dbxButtonFloating = input<Maybe<DbxButtonFloatingConfig | DbxButtonFloatingPosition | ''>>();

  readonly dbxButtonFloatingMode = input<Maybe<DbxButtonFloatingMode>>();
  readonly dbxButtonFloatingPosition = input<Maybe<DbxButtonFloatingPosition>>();
  readonly dbxButtonFloatingOffset = input<Maybe<DbxButtonFloatingOffset>>();

  readonly configSignal = computed<Maybe<DbxButtonFloatingConfig>>(() => {
    const value = this.dbxButtonFloating();
    let config: Maybe<DbxButtonFloatingConfig>;

    if (typeof value === 'string') {
      config = value ? { position: value } : undefined;
    } else {
      config = value;
    }

    return config;
  });

  readonly modeSignal = computed<DbxButtonFloatingMode>(() => {
    const config = this.configSignal();
    return this.dbxButtonFloatingMode() ?? config?.mode ?? 'sticky';
  });
  readonly positionSignal = computed<DbxButtonFloatingPosition>(() => {
    const config = this.configSignal();
    return this.dbxButtonFloatingPosition() ?? config?.position ?? DEFAULT_DBX_BUTTON_FLOATING_POSITION;
  });

  readonly isFixedSignal = computed(() => this.modeSignal() === 'fixed');
  readonly isTopSignal = computed(() => this.positionSignal().startsWith('top-'));
  readonly horizontalAlignmentSignal = computed(() => this.positionSignal().split('-')[1] as DbxButtonFloatingHorizontalAlignment);

  readonly offsetXSignal = computed(() => {
    const config = this.configSignal();
    return toDbxButtonFloatingOffsetCssValue(this.dbxButtonFloatingOffset() ?? config?.offsetX ?? config?.offset);
  });

  readonly offsetYSignal = computed(() => {
    const config = this.configSignal();
    return toDbxButtonFloatingOffsetCssValue(this.dbxButtonFloatingOffset() ?? config?.offsetY ?? config?.offset);
  });
}

/**
 * Converts a {@link DbxButtonFloatingOffset} into a CSS value. Numbers are converted to pixel strings.
 *
 * @param offset - The offset to convert.
 * @returns The CSS value, or undefined if no offset is provided.
 */
function toDbxButtonFloatingOffsetCssValue(offset: Maybe<DbxButtonFloatingOffset>): Maybe<PixelsString | CssTokenVar> {
  return typeof offset === 'number' ? `${offset}px` : (offset ?? undefined);
}
