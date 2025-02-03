import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { type Maybe } from '@dereekb/util';

export interface DbxDialogContentFooterConfig {
  buttonColor?: ThemePalette;
  closeText?: string;
}

/**
 * Component used to show a close button at the bottom of a dialog.
 */
@Component({
  selector: 'dbx-dialog-content-footer',
  template: `
    <button mat-raised-button [color]="buttonColor" (click)="closeClicked()">{{ closeText }}</button>
  `,
  host: {
    class: 'dbx-dialog-content-footer'
  }
})
export class DbxDialogContentFooterComponent implements OnDestroy {
  @Input()
  closeText = 'Close';

  @Input()
  buttonColor: ThemePalette = undefined;

  @Output()
  readonly close = new EventEmitter<void>();

  @Input()
  set config(config: Maybe<DbxDialogContentFooterConfig>) {
    this.closeText = config?.closeText ?? 'Close';
    this.buttonColor = config?.buttonColor ?? undefined;
  }

  closeClicked() {
    this.close.emit(undefined);
  }

  ngOnDestroy(): void {
    this.close.complete();
  }
}
