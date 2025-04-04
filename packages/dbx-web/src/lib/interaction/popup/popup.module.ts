import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxPopupCoordinatorComponent } from './popup.coordinator.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbxPopupService } from './popup.service';
import { DbxPopupContentComponent } from './popup.content.component';
import { DbxPopupComponent } from './popup.component';
import { DbxRouterAnchorModule } from '../../router';
import { DbxActionModule } from '../../action/action.module';
import { DbxPopupControlsComponent } from './popup.controls.component';
import { DbxPopupControlButtonsComponent } from './popup.controls.buttons.component';
import { DbxButtonModule } from '../../button/button.module';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';

const importsAndExports = [DbxPopupComponent, DbxPopupCoordinatorComponent, DbxPopupContentComponent, DbxPopupControlsComponent, DbxPopupControlButtonsComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPopupInteractionModule {}
