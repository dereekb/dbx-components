import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { DbxPopupController, DbxPopupWindowState } from './popup';

/**
 * Popup Control Buttons.
 */
@Component({
  selector: 'dbx-popup-control-buttons',
  template: `
    <ng-container [ngSwitch]="isMinimized$ | async">
      <dbx-button [flat]="true" *ngSwitchCase="false" icon="minimize" (buttonClick)="minimizeClicked()"></dbx-button>
      <dbx-button [flat]="true" *ngSwitchCase="true" icon="maximize" (buttonClick)="maximizeClicked()"></dbx-button>
    </ng-container>
    <dbx-button-spacer></dbx-button-spacer>
    <ng-container [ngSwitch]="isFullscreen$ | async">
      <dbx-button [flat]="true" *ngSwitchCase="false" icon="open_in_full" (buttonClick)="fullscreenClicked()"></dbx-button>
      <dbx-button [flat]="true" *ngSwitchCase="true" icon="close_fullscreen" (buttonClick)="normalscreenClicked()"></dbx-button>
    </ng-container>
    <dbx-button-spacer></dbx-button-spacer>
    <dbx-button [flat]="true" icon="close" color="warn" (buttonClick)="closeClicked()"></dbx-button>
  `,
  host: {
    class: 'dbx-popup-control-buttons'
  }
})
export class DbxPopupControlButtonsComponent {
  private readonly _appPopupController = inject(DbxPopupController);

  readonly isMinimized$ = this._appPopupController.windowState$.pipe(map((x) => x === DbxPopupWindowState.MINIMIZED));
  readonly isFullscreen$ = this._appPopupController.windowState$.pipe(map((x) => x === DbxPopupWindowState.FULLSCREEN));

  minimizeClicked(): void {
    this._appPopupController.minimize();
  }

  maximizeClicked(): void {
    this._appPopupController.normalscreen();
  }

  fullscreenClicked(): void {
    this._appPopupController.fullscreen();
  }

  normalscreenClicked(): void {
    this._appPopupController.normalscreen();
  }

  closeClicked(): void {
    this._appPopupController.close();
  }
}
