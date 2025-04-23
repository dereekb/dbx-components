import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { DbxPopupKey, AbstractPopupDirective, DbxPopupService, DbxPopupContentComponent, DbxPopupControlsComponent } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';

export const DEFAULT_FIREBASE_DEVELOPMENT_POPUP_KEY = 'devpopup';

@Component({
  template: `
    <dbx-popup-content>
      <dbx-popup-controls [header]="header" controls></dbx-popup-controls>
      <dbx-firebase-development-popup-content (shouldClose)="closePopup()"></dbx-firebase-development-popup-content>
    </dbx-popup-content>
  `,
  imports: [DbxPopupContentComponent, DbxPopupControlsComponent, DbxFirebaseDevelopmentPopupContentComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseDevelopmentPopupComponent extends AbstractPopupDirective {
  private readonly popupService = inject(DbxPopupService);

  readonly content = viewChild.required(DbxFirebaseDevelopmentPopupContentComponent);

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
