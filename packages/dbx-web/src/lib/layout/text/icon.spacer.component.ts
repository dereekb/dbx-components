import { Directive } from '@angular/core';

/**
 * Icon spacer directive.
 */
@Directive({
  selector: 'dbx-icon-spacer,[dbxIconSpacer]',
  host: {
    class: 'dbx-icon-spacer d-inline'
  },
  standalone: true
})
export class DbxIconSpacerDirective {}
