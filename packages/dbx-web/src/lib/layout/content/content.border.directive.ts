import { Directive } from '@angular/core';

/**
 * Section used to wrap content in a border with internal padding.
 */
@Directive({
  selector: 'dbx-content-border,[dbx-content-border]',
  host: {
    'class': 'd-block dbx-content-border'
  }
})
export class DbxContentBorderDirective { }
