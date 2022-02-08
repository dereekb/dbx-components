import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxPopupCoordinatorComponent } from './popup.coordinator.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbxPopupService } from './popup.service';
import { DbxPopupContentComponent } from './popup.content.component';
import { DbxPopupComponent } from './popup.component';
import { DbxAnchorModule } from '../../router';
import { DbxActionModule } from '../../action/action.module';
import { DbxPopupControlsComponent } from './popup.controls.component';
import { DbxPopupControlButtonsComponent } from './popup.controls.buttons.component';
import { DbxButtonModule } from '../../button/button.module';
import { DbxPopupCoordinatorService } from './popup.coordinator.service';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxButtonModule,
    DbxAnchorModule,
    DbxActionModule,
    DbxInjectedComponentModule,
    NgOverlayContainerModule,
  ],
  declarations: [
    DbxPopupComponent,
    DbxPopupCoordinatorComponent,
    DbxPopupContentComponent,
    DbxPopupControlsComponent,
    DbxPopupControlButtonsComponent
  ],
  exports: [
    DbxPopupContentComponent,
    DbxPopupControlsComponent,
    DbxPopupControlButtonsComponent
  ],
  providers: [
    DbxPopupService
  ]
})
export class DbxPopupInteractionModule {

  static forRoot(): ModuleWithProviders<DbxPopupInteractionModule> {
    return {
      ngModule: DbxPopupInteractionModule,
      providers: [
        DbxPopupCoordinatorService
      ]
    };
  }

}
