import { computed, Directive, input } from '@angular/core';
import { type DbxColorTone, type DbxThemeColor, dbxColorBackground } from './style';
import { cssTokenVar, type Maybe } from '@dereekb/util';

/**
 * Applies a themed background color to the host element based on a {@link DbxThemeColor} value.
 *
 * Optionally set {@link dbxColorTone} to control background opacity for a tonal/muted appearance.
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
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()',
    '[style.color]': 'tonalColorSignal()'
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
   * Sets `--dbx-color-bg-tone` on the host to control the background opacity via `color-mix` in the `-bg` class mixin.
   */
  readonly bgToneStyleSignal = computed(() => {
    const tone = this.dbxColorTone();
    return tone != null ? `${tone}%` : null;
  });

  /**
   * Overrides the host text color to use the vibrant theme color when tonal mode is active.
   *
   * Normally a `-bg` class sets the contrast color as text (e.g. white on blue).
   * In tonal mode the background is semi-transparent, so white text would be unreadable.
   * Instead we use `--dbx-bg-color-current` (the vibrant color set by the `-bg` mixin) as the text color.
   */
  readonly tonalColorSignal = computed(() => {
    return this.dbxColorTone() != null ? cssTokenVar('--dbx-bg-color-current') : null;
  });
}
