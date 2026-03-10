import { computed, Directive, input } from '@angular/core';
import { type DbxThemeColor, dbxColorBackground } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Applies a themed background color to the host element based on a {@link DbxThemeColor} value.
 *
 * @example
 * ```html
 * <div [dbxColor]="'primary'">Themed background</div>
 * ```
 */
@Directive({
  selector: '[dbxColor]',
  host: {
    '[class]': 'cssClassSignal()',
    '[class.dbx-color]': 'true'
  },
  standalone: true
})
export class DbxColorDirective {
  readonly dbxColor = input<Maybe<DbxThemeColor | ''>>();
  readonly cssClassSignal = computed(() => dbxColorBackground(this.dbxColor()));
}
