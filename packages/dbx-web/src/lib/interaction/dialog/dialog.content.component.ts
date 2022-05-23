import { Directive, Input } from '@angular/core';

export type DbxDialogContentContainerWidth = 'normal' | 'wide';

/**
 * Component used to style a dialog.
 */
@Directive({
  selector: 'dbx-dialog-content,[dbxDialogContent].dbx-dialog-content',
  host: {
    'class': 'dbx-dialog-content',
    '[class]': `width + '-dialog-content'`
  }
})
export class DbxDialogContentDirective {

  @Input()
  width = 'normal'

}
