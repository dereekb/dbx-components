import { Component } from '@angular/core';
import { map } from 'rxjs/operators';
import { DbNgxPopupController, DbNgxPopupWindowState } from './popup';

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
export class DbNgxPopupContentComponent {

  readonly showContent$ = this.appPopupController.windowState$.pipe(map(x => x !== DbNgxPopupWindowState.MINIMIZED));

  constructor(private appPopupController: DbNgxPopupController) { }

}
