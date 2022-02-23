import { Directive } from '@angular/core';

/**
 * Section used to elevate content in a pre-configured manner.
 */
@Directive({
  selector: 'dbx-content-elevate,[dbx-content-elevate]',
  host: {
    'class': 'd-block dbx-content-elevate'
  }
})
export class DbxContentElevateDirective { }
