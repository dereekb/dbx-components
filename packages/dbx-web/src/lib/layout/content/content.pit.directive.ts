import { Directive } from '@angular/core';

/**
 * Component used to wrap content in a pit with a label.
 */
@Directive({
  selector: 'dbx-content-pit, [dbxContentPit]',
  host: {
    class: 'd-block dbx-content-pit'
  }
})
export class DbxContentPitDirective {}
