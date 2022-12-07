import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';

/**
 * Component used to show a close button at the top of a dialog, floating in a corner.
 */
@Component({
  selector: 'dbx-dialog-content-close',
  template: `
    <button mat-icon-button (click)="closeClicked()"><mat-icon>close</mat-icon></button>
  `,
  host: {
    class: 'dbx-dialog-content-close'
  }
})
export class DbxDialogContentCloseComponent implements OnDestroy {
  @Output()
  readonly close = new EventEmitter<void>();

  closeClicked() {
    this.close.emit(undefined);
  }

  ngOnDestroy(): void {
    this.close.complete();
  }
}
