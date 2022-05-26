import { Directive } from '@angular/core';

@Directive({
  selector: 'dbx-spacer, [dbxSpacer]',
  host: {
    class: 'dbx-spacer'
  }
})
export class DbxSpacerDirective {}
