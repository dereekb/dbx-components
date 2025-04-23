import { computed, Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a wrapper for content distributed along a bar.
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
    return color ? `dbx-${color}-bg` : 'dbx-bg';
  });
}
