import { Directive } from '@angular/core';

@Directive({
  selector: 'dbx-spacer, [dbx-spacer]',
  host: {
    'class': 'dbx-spacer'
  }
})
export class DbxSpacerDirective { }
