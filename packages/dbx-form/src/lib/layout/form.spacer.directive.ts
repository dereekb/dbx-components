import { Directive } from '@angular/core';

/**
 * Provides vertical spacing after a form.
 */
@Directive({
  selector: 'dbx-form-spacer,[dbxFormSpacer],.dbx-form-spacer',
  host: {
    class: 'd-block dbx-form-spacer'
  },
  standalone: true
})
export class DbxFormSpacerDirective {}
