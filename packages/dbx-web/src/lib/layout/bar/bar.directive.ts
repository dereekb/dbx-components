import { Input, Directive } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a wrapper for content distributed along a bar.
 */
@Directive({
  selector: 'dbx-bar,[dbxBar]',
  host: {
    class: 'dbx-bar',
    '[class]': 'color ? ("dbx-" + color + "-bg") : "dbx-bg"'
  }
})
export class DbxBarDirective {
  @Input()
  color?: Maybe<DbxBarColor>;
}
