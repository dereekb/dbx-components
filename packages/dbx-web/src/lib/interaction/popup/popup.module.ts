import { DbxPopupCoordinatorComponent } from './popup.coordinator.component';
import { NgModule } from '@angular/core';
import { DbxPopupContentComponent } from './popup.content.component';
import { DbxPopupComponent } from './popup.component';
import { DbxPopupControlsComponent } from './popup.controls.component';
import { DbxPopupControlButtonsComponent } from './popup.controls.buttons.component';

const importsAndExports = [DbxPopupComponent, DbxPopupCoordinatorComponent, DbxPopupContentComponent, DbxPopupControlsComponent, DbxPopupControlButtonsComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPopupInteractionModule {}
