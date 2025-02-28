import { Directive, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Component used to wrap content in a pit with a label.
 */
@Directive({
  selector: 'dbx-content-pit, [dbxContentPit]',
  host: {
    class: 'd-block dbx-content-pit',
    '[class.dbx-content-pit-scrollable]': 'scrollable'
  }
})
export class DbxContentPitDirective {
  @Input()
  scrollable?: Maybe<boolean>;
}
