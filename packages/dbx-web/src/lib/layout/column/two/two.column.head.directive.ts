import { Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Two Columns related component that sits at the top of the content bodies and wraps content.
 */
@Directive({
  selector: 'dbx-two-column-head,[dbxTwoColumnHead],.dbx-two-column-head',
  host: {
    class: 'd-flex dbx-two-column-head',
    '[class.d-block]': 'block()',
    '[class.full]': 'full()'
  },
  standalone: true
})
export class DbxTwoColumnColumnHeadDirective {
  readonly block = input<Maybe<boolean>>(false);
  readonly full = input<Maybe<boolean>>(false);
}
