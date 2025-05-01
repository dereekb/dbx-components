import { DocInteractionExamplePopupComponent } from './../component/interaction.popup.component';
import { Component, AfterViewInit, inject } from '@angular/core';
import { DbxPopupService, PopupPosition } from '@dereekb/dbx-web';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';

@Component({
    templateUrl: './popup.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxButtonSpacerDirective]
})
export class DocInteractionPopupComponent implements AfterViewInit {
  readonly popupService = inject(DbxPopupService);

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePopup(), 100);
  }

  openExamplePopup(key?: string, position?: PopupPosition) {
    DocInteractionExamplePopupComponent.openPopup(
      this.popupService,
      {
        isDraggable: true,
        position
      },
      key
    );
  }
}
