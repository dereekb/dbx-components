import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { DbxPopupComponent, DbxPopupKey, AbstractPopupDirective, DbxPopupService, PopupPosition } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';

export const DEFAULT_FIREBASE_DEVELOPMENT_POPUP_KEY = 'devpopup';

@Component({
  template: `
    <dbx-popup-content>
      <dbx-popup-controls [header]="header" controls></dbx-popup-controls>
      <dbx-firebase-development-popup-content (shouldClose)="closePopup()"></dbx-firebase-development-popup-content>
    </dbx-popup-content>
  `
})
export class DbxFirebaseDevelopmentPopupComponent extends AbstractPopupDirective {
  @ViewChild(DbxFirebaseDevelopmentPopupContentComponent, { static: true })
  content!: DbxFirebaseDevelopmentPopupContentComponent;

  readonly header = 'Development Tools';

  constructor(popup: DbxPopupComponent, private readonly popupService: DbxPopupService) {
    super(popup);
  }

  static openPopup(popupService: DbxPopupService, popupKey?: DbxPopupKey): NgPopoverRef {
    return popupService.open({
      key: popupKey ?? DEFAULT_FIREBASE_DEVELOPMENT_POPUP_KEY,
      componentClass: DbxFirebaseDevelopmentPopupComponent
    });
  }

  reopen = () => {
    DbxFirebaseDevelopmentPopupComponent.openPopup(this.popupService, this.popup.key);
  };
}
