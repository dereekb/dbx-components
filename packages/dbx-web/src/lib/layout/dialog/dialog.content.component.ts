import { Component, Input } from '@angular/core';

export enum DbNgxDialogContentContainerWidth {
  NORMAL = 'normal',
  WIDE = 'wide'
}

/**
 * Component used to style a dialog.
 */
@Component({
  selector: 'dbx-dialog-content',
  template: `
  <div class="dbx-dialog-content" [ngClass]="width + '-dialog-content'">
    <ng-content></ng-content>
  </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbNgxDialogContentComponent {

  @Input()
  width = DbNgxDialogContentContainerWidth.NORMAL;

}
