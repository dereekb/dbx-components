import { Component } from '@angular/core';
import { map } from 'rxjs';
import { DbxPopupController, DbxPopupWindowState } from './popup';

/**
 * Popup content wrapper component.
 */
@Component({
  selector: 'dbx-popup-content',
  template: `
    <ng-content select="[controls]"></ng-content>
    <div *ngIf="showContent$ | async" class="dbx-popup-content-container">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-popup-content'
  }
})
export class DbxPopupContentComponent {
  readonly showContent$ = this.appPopupController.windowState$.pipe(map((x) => x !== DbxPopupWindowState.MINIMIZED));

  constructor(private appPopupController: DbxPopupController) {}
}
