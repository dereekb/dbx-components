import { computed, Directive, input } from '@angular/core';
import { type Pixels, type PixelsString, type Maybe } from '@dereekb/util';

/**
 * Input type for the pit's scrollable behavior. Pass `true` for default medium height,
 * `false` to disable scrolling, or a specific height value.
 */
export type DbxContentPitScrollableInput = boolean | DbxContentPitScrollableHeight;

/**
 * Height specification for a scrollable pit. Accepts a pixel number, a CSS pixel string, or a named preset.
 */
export type DbxContentPitScrollableHeight = Pixels | PixelsString | DbxContentPitScrollableHeightSetting;

/**
 * Named height presets for a scrollable pit: `'small'` (120px), `'medium'` (320px), or `'large'` (460px).
 */
export type DbxContentPitScrollableHeightSetting = 'small' | 'medium' | 'large';

/**
 * Wraps content in a recessed "pit" container with optional scrollable overflow and rounded corners.
 * Useful for displaying bounded content areas such as lists or previews with a constrained height.
 *
 * @dbxWebComponent
 * @dbxWebSlug content-pit
 * @dbxWebCategory layout
 * @dbxWebRelated content-box, content-elevate
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-content-pit>Body</dbx-content-pit>
 * ```
 *
 * @example
 * ```html
 * <div dbxContentPit>Inset block</div>
 * ```
 */
@Directive({
  selector: 'dbx-content-pit, [dbxContentPit]',
  host: {
    class: 'd-block dbx-content-pit',
    '[class.dbx-content-pit-scrollable]': 'scrollableHeightSignal() != null',
    '[class.dbx-content-pit-rounded]': 'rounded()',
    '[style.max-height]': 'scrollableHeightSignal()'
  },
  standalone: true
})
export class DbxContentPitDirective {
  readonly scrollable = input<Maybe<DbxContentPitScrollableInput>>();
  readonly rounded = input<boolean>(false);

  readonly scrollableHeightSignal = computed(() => {
    let scrollable = this.scrollable();
    let scrollableHeight: PixelsString | undefined;

    if (typeof scrollable === 'boolean') {
      scrollable = scrollable ? 'medium' : undefined; // defaults to medium
    }

    if (scrollable) {
      if (typeof scrollable === 'string') {
        switch (scrollable) {
          case 'small':
            scrollable = 120;
            break;
          case 'medium':
            scrollable = 320;
            break;
          case 'large':
            scrollable = 460;
            break;
          default:
            scrollableHeight = scrollable; // use as-is
            break;
        }
      }

      if (typeof scrollable === 'number') {
        scrollableHeight = `${scrollable}px`;
      }
    }

    return scrollableHeight ?? null;
  });
}
