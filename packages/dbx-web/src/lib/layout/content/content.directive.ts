import { Directive } from '@angular/core';

/**
 * Directive that sets the height of it's content to fill the page.
 */
@Directive({
  selector: 'dbx-content,[dbxContent]',
  host: {
    class: 'd-block dbx-content'
  }
})
export class DbxContentDirective {}
