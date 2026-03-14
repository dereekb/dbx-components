import { Directive } from '@angular/core';

/**
 * Provides vertical spacing after a form.
 *
 * Can be used as an element (`<dbx-form-spacer>`), attribute (`[dbxFormSpacer]`), or CSS class (`.dbx-form-spacer`).
 *
 * @selector `dbx-form-spacer,[dbxFormSpacer],.dbx-form-spacer`
 */
@Directive({
  selector: 'dbx-form-spacer,[dbxFormSpacer],.dbx-form-spacer',
  host: {
    class: 'd-block dbx-form-spacer'
  },
  standalone: true
})
export class DbxFormSpacerDirective {}
