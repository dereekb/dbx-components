import { Directive } from '@angular/core';

@Directive({
  selector: 'dbx-spacer, [dbxSpacer]',
  host: {
    class: 'dbx-spacer'
  },
  standalone: true
})
export class DbxSpacerDirective {}
