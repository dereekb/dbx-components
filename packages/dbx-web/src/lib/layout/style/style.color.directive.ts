import { computed, Directive, input } from '@angular/core';
import { type DbxColorTone, type DbxThemeColor, dbxColorBackground } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Applies a themed background color to the host element based on a {@link DbxThemeColor} value.
 *
 * Optionally set {@link dbxColorTone} to control background opacity for a tonal/muted appearance.
 * When tonal mode is active, the `dbx-color-tonal` CSS class is added and a CSS rule
 * overrides the text color to the vibrant theme color (via `--dbx-bg-color-current`).
 *
 * @example
 * ```html
 * <div [dbxColor]="'primary'">Full background</div>
 * <div [dbxColor]="'primary'" [dbxColorTone]="18">Tonal background</div>
 * ```
 */
@Directive({
  selector: '[dbxColor]',
  host: {
    '[class]': 'cssClassSignal()',
    '[class.dbx-color]': 'true',
    '[class.dbx-color-tonal]': 'isTonalSignal()',
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()'
  },
  standalone: true
})
export class DbxColorDirective {
  readonly dbxColor = input<Maybe<DbxThemeColor | ''>>();

  /**
   * Background tone level (0-100). When set, the background becomes semi-transparent
   * and text color switches to the vibrant theme color for a tonal appearance.
   */
  readonly dbxColorTone = input<Maybe<DbxColorTone>>();

  readonly cssClassSignal = computed(() => dbxColorBackground(this.dbxColor()));

  /**
   * Whether tonal mode is active. Adds the `dbx-color-tonal` CSS class which
   * overrides the text color to the vibrant theme color via CSS rather than
   * an inline style binding (which would conflict with `[ngStyle]`).
   */
  readonly isTonalSignal = computed(() => this.dbxColorTone() != null);

  /**
   * Sets `--dbx-color-bg-tone` on the host to control the background opacity via `color-mix` in the `-bg` class mixin.
   */
  readonly bgToneStyleSignal = computed(() => {
    const tone = this.dbxColorTone();
    return tone != null ? `${tone}%` : null;
  });
}
