import { DocInteractionExamplePopupComponent } from './../component/interaction.popup.component';
import { Component, AfterViewInit } from '@angular/core';
import { DbxPopupService, PopupPosition } from '@dereekb/dbx-web';

@Component({
  templateUrl: './popup.component.html'
})
export class DocInteractionPopupComponent implements AfterViewInit {

  constructor(readonly popupService: DbxPopupService) { }

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePopup(), 100);
  }

  openExamplePopup(key?: string, position?: PopupPosition) {
    DocInteractionExamplePopupComponent.openPopup(this.popupService, {
      isDraggable: true,
      position
    }, key);
  }

}
