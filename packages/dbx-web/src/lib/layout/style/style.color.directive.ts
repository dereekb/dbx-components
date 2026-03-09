import { computed, Directive, input } from '@angular/core';
import { type DbxThemeColor, dbxColorBackground } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Used to apply a background style using a color.
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
