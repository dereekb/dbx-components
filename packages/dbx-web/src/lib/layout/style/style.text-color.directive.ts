import { computed, Directive, input } from '@angular/core';
import { type DbxThemeColor } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Applies a themed text color to the host element based on a {@link DbxThemeColor} value.
 *
 * Unlike {@link DbxColorDirective} which sets the background color, this directive only sets
 * the foreground text color using the `dbx-{color}` CSS class.
 *
 * @example
 * ```html
 * <mat-icon [dbxTextColor]="'warn'">error</mat-icon>
 * <span [dbxTextColor]="'primary'">Themed text</span>
 * ```
 */
@Directive({
  selector: '[dbxTextColor]',
  host: {
    '[class]': 'cssClassSignal()'
  },
  standalone: true
})
export class DbxTextColorDirective {
  readonly dbxTextColor = input<Maybe<DbxThemeColor | ''>>();

  readonly cssClassSignal = computed(() => {
    const color = this.dbxTextColor();

    if (color) {
      return `dbx-${color}`;
    }

    return '';
  });
}
