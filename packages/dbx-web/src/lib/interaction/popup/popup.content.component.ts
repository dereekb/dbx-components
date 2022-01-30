import { Component } from '@angular/core';
import { map } from 'rxjs/operators';
import { DbxPopupController, DbxPopupWindowState } from './popup';

/**
 * Popup content wrapper component.
 */
@Component({
  selector: 'dbx-popup-content',
  template: `
  <div class="dbx-popup-content">
    <ng-content select="[controls]"></ng-content>
    <div *ngIf="showContent$ | async" class="dbx-popup-content-container">
      <ng-content></ng-content>
    </div>
  </div>
`,
  // TODO: styleUrls: ['./popup.scss']
})
export class DbxPopupContentComponent {

  readonly showContent$ = this.appPopupController.windowState$.pipe(map(x => x !== DbxPopupWindowState.MINIMIZED));

  constructor(private appPopupController: DbxPopupController) { }

}
