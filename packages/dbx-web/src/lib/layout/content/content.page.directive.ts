import { Directive } from '@angular/core';

/**
 * Directive that sets the height of it's content to fill the page.
 */
@Directive({
  selector: 'dbx-content-page,[dbx-content-page]',
  host: {
    'class': 'd-block dbx-content-page'
  }
})
export class DbxContentPageDirective { }
