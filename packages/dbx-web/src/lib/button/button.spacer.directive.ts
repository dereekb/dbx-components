import { Directive } from '@angular/core';

/**
 * Button spacer directive.
 */
@Directive({
  selector: 'dbx-button-spacer,[dbxButtonSpacer]',
  host: {
    class: 'dbx-button-spacer d-inline'
  },
  standalone: true
})
export class DbxButtonSpacerDirective {}
