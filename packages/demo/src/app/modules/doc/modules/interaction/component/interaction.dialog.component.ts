import { Component } from '@angular/core';
import { PopupPosition, AbstractDialogDirective } from '@dereekb/dbx-web';

export const DEFAULT_INTERACTION_POPUP_COMPOSER_POPUP_KEY = 'popup';

export interface DocInteractionPopupConfig {
  draggable?: boolean;
  position?: PopupPosition;
}

@Component({
  template: `
  <dbx-dialog-content>
    <p>This is a dialog.</p>
    <button mat-raised-button (click)="close()">Closed</button>
  </dbx-dialog-content>
  `
})
export class DocInteractionExampleDialogComponent extends AbstractDialogDirective { }
