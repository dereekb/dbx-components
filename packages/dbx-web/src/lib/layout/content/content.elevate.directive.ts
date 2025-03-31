import { Directive, input, Input } from '@angular/core';

/**
 * Section used to elevate content in a pre-configured manner.
 */
@Directive({
  selector: 'dbx-content-elevate,[dbxContentElevate]',
  host: {
    class: 'd-block',
    '[class.dbx-content-elevate]': 'elevate()'
  },
  standalone: true
})
export class DbxContentElevateDirective {
  readonly elevate = input<boolean>(true);
}
