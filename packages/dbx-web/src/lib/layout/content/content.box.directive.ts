import { Directive, input } from '@angular/core';

/**
 * Component used to wrap content in a box with optionally elevation.
 */
@Directive({
  selector: 'dbx-content-box, [dbxContentBox]',
  host: {
    class: 'd-block dbx-content-box',
    '[class.dbx-content-elevate]': 'elevate()',
    '[class.dbx-content-box-wide]': 'wide()'
  },
  standalone: true
})
export class DbxContentBoxDirective {
  readonly elevate = input<boolean>(true);
  readonly wide = input<boolean>(true);
}
