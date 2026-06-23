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
 * Pits round their corners by default. Pass `[square]="true"` to square the pit — this applies the
 * common `.dbx-corners-none` opt-out utility rather than a pit-specific class.
 *
 * When `[scrollable]` is set the pit frame (padding, background, corners) stays fixed and an inner
 * `.dbx-content-pit-scrollable-content` wrapper does the scrolling — wrap the body in that element so
 * the frame doesn't shift at the scroll extremes. The resolved max height is published as the
 * `--dbx-content-pit-scrollable-max-height` custom property, which the inner wrapper reads.
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
    '[class.dbx-corners-none]': 'square()',
    '[style.--dbx-content-pit-scrollable-max-height]': 'scrollableMaxHeightSignal()'
  },
  standalone: true
})
export class DbxContentPitDirective {
  readonly scrollable = input<Maybe<DbxContentPitScrollableInput>>();
  readonly square = input<boolean>(false);

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

  // The pit always publishes its own scroll cap so the `.dbx-content-pit-scrollable-content`
  // wrapper reads it directly rather than inheriting the global `--dbx-content-pit-scrollable-max-height`
  // default (140px) from the theme root. `none` when not scrollable lets the wrapper grow freely.
  readonly scrollableMaxHeightSignal = computed<PixelsString | 'none'>(() => this.scrollableHeightSignal() ?? 'none');
}
