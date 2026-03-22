import { computed, Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxThemeColor, dbxThemeColorCssTokenVar } from '../style/style';

/**
 * Border opacity preset values.
 *
 * - `'lite'` — 50% opacity (default)
 * - `'full'` — 100% opacity
 */
export type DbxContentBorderOpacity = 'lite' | 'full';

/**
 * Wraps the host element in a themed dashed border with internal padding. The border color
 * can be set to any theme color (defaults to `'default'`). Only the border is colored —
 * text color is not affected.
 *
 * The border opacity defaults to `'lite'` (50%). Set `borderOpacity` to `'full'` for
 * full opacity, or provide a custom percentage string (e.g., `'75%'`).
 *
 * @example
 * ```html
 * <dbx-content-border color="primary">
 *   <p>Lite primary border (default 50% opacity).</p>
 * </dbx-content-border>
 *
 * <dbx-content-border color="warn" borderOpacity="full">
 *   <p>Full opacity warn border.</p>
 * </dbx-content-border>
 *
 * <div dbxContentBorder color="accent" borderOpacity="75%">
 *   <p>Custom 75% opacity accent border.</p>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-content-border,[dbxContentBorder]',
  host: {
    class: 'd-block dbx-content-border',
    '[style.--dbx-border-color]': 'borderColorVar()',
    '[style.--dbx-border-opacity]': 'borderOpacityValue()'
  },
  standalone: true
})
export class DbxContentBorderDirective {
  readonly color = input<DbxThemeColor>('default');

  readonly borderOpacity = input<Maybe<DbxContentBorderOpacity | string>>('lite');

  readonly borderColorVar = computed(() => dbxThemeColorCssTokenVar(this.color(), true));

  readonly borderOpacityValue = computed(() => {
    const color = this.color();
    const opacity = this.borderOpacity();
    let result: string;

    switch (opacity) {
      case 'full':
        result = '100%';
        break;
      case 'lite':
      case undefined:
      case null:
        result = color === 'default' ? 'inherit' : '50%';
        break;
      default:
        result = opacity;
        break;
    }

    return result;
  });
}
