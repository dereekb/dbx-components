import { Component } from '@angular/core';
import { map } from 'rxjs/operators';
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
    'class': 'dbx-popup-control-buttons'
  }
})
export class DbxPopupControlButtonsComponent {

  readonly isMinimized$ = this.appPopupController.windowState$.pipe(map(x => x === DbxPopupWindowState.MINIMIZED));
  readonly isFullscreen$ = this.appPopupController.windowState$.pipe(map(x => x === DbxPopupWindowState.FULLSCREEN));

  constructor(private appPopupController: DbxPopupController) { }

  minimizeClicked(): void {
    this.appPopupController.minimize();
  }

  maximizeClicked(): void {
    this.appPopupController.normalscreen();
  }

  fullscreenClicked(): void {
    this.appPopupController.fullscreen();
  }

  normalscreenClicked(): void {
    this.appPopupController.normalscreen();
  }

  closeClicked(): void {
    this.appPopupController.close();
  }

}
