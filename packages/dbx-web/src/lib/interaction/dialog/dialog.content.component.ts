import { Component, Input } from '@angular/core';

export type DbxDialogContentContainerWidth = 'normal' | 'wide';

/**
 * Component used to style a dialog.
 */
@Component({
  selector: 'dbx-dialog-content',
  template: `
    <dbx-style>
      <ng-content></ng-content>
    </dbx-style>
  `,
  host: {
    'class': 'dbx-dialog-content',
    '[class]': `width + '-dialog-content'`
  }
})
export class DbxDialogContentComponent {

  @Input()
  width = 'normal'

}
