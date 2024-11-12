import { Component, ViewChild, inject } from '@angular/core';
import { DbxPopupComponent, DbxPopupKey, AbstractPopupDirective, DbxPopupService } from '@dereekb/dbx-web';
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
  private readonly popupService = inject(DbxPopupService);

  @ViewChild(DbxFirebaseDevelopmentPopupContentComponent, { static: true })
  content!: DbxFirebaseDevelopmentPopupContentComponent;

  readonly header = 'Development Tools';

  static openPopup(popupService: DbxPopupService, popupKey?: DbxPopupKey): NgPopoverRef {
    return popupService.open({
      key: popupKey ?? DEFAULT_FIREBASE_DEVELOPMENT_POPUP_KEY,
      componentClass: DbxFirebaseDevelopmentPopupComponent,
      closeOnTransition: false,
      isDraggable: true,
      position: 'center'
    });
  }

  reopen = () => {
    DbxFirebaseDevelopmentPopupComponent.openPopup(this.popupService, this.popup.key);
  };
}
