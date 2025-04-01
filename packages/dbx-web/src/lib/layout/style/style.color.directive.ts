import { computed, Directive, input, Input } from '@angular/core';
import { DbxThemeColor, dbxColorBackground } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Used to apply a background style using a color.
 */
@Directive({
  selector: '[dbxColor]',
  host: {
    '[class]': 'cssClassSignal()'
  },
  standalone: true
})
export class DbxColorDirective {
  readonly dbxColor = input<Maybe<DbxThemeColor | ''>>();
  readonly cssClassSignal = computed(() => dbxColorBackground(this.dbxColor()));
}
