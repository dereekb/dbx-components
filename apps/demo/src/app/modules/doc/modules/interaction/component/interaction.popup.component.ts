import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { DbxPopupComponent, DbxPopupKey, AbstractPopupDirective, DbxPopupService, PopupPosition } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DocInteractionExamplePopupContentComponent } from './interaction.popup.content.component';

export const DEFAULT_INTERACTION_POPUP_COMPOSER_POPUP_KEY = 'popup';

export interface DocInteractionPopupConfig {
  isDraggable?: boolean;
  position?: PopupPosition;
}

@Component({
  template: `
    <dbx-popup-content>
      <dbx-popup-controls [header]="header" controls></dbx-popup-controls>
      <dbx-interaction-example-popup-content (shouldClose)="closePopup()" [reopen]="reopen"></dbx-interaction-example-popup-content>
    </dbx-popup-content>
  `
})
export class DocInteractionExamplePopupComponent<O> extends AbstractPopupDirective<O, DocInteractionPopupConfig> implements OnInit, OnDestroy {
  @ViewChild(DocInteractionExamplePopupContentComponent, { static: true })
  content!: DocInteractionExamplePopupContentComponent;

  readonly header = 'example';

  get config(): DocInteractionPopupConfig {
    return this.popup.data as DocInteractionPopupConfig;
  }

  constructor(popup: DbxPopupComponent<O, DocInteractionPopupConfig>, private readonly popupService: DbxPopupService) {
    super(popup);
  }

  static openPopup(popupService: DbxPopupService, config: DocInteractionPopupConfig, popupKey?: DbxPopupKey): NgPopoverRef {
    return popupService.open({
      key: popupKey ?? DEFAULT_INTERACTION_POPUP_COMPOSER_POPUP_KEY,
      componentClass: DocInteractionExamplePopupComponent,
      data: config,
      isDraggable: config.isDraggable,
      position: config.position
    });
  }

  reopen = () => {
    DocInteractionExamplePopupComponent.openPopup(this.popupService, this.config, this.popup.key);
  };

  ngOnInit(): void {}

  ngOnDestroy(): void {}
}
