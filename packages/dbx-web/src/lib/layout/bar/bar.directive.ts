import { computed, Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxBarColor } from './bar';
import { dbxColorBackground } from '../style/style';

/**
 * Renders a horizontal bar with a themed background color, used to visually group or separate content.
 *
 * @example
 * ```html
 * <dbx-bar color="primary">
 *   <span>Bar content</span>
 * </dbx-bar>
 * ```
 */
@Directive({
  selector: 'dbx-bar,[dbxBar]',
  host: {
    class: 'dbx-bar',
    '[class]': 'cssClassSignal()'
  },
  standalone: true
})
export class DbxBarDirective {
  readonly color = input<Maybe<DbxBarColor>>();

  readonly cssClassSignal = computed(() => {
    const color = this.color();
    return color ? dbxColorBackground(color) : '';
  });
}
