import { DbNgxPopupCoordinatorComponent } from './popup.coordinator.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbNgxPopupService } from './popup.service';
import { DbNgxPopupContentComponent } from './popup.content.component';
import { DbNgxPopupComponent } from './popup.component';
import { DbNgxAnchorModule } from '../../router';
import { DbNgxActionModule } from '../../action/action.module';
import { DbNgxPopupControlsComponent } from './popup.controls.component';
import { DbNgxPopupControlButtonsComponent } from './popup.controls.buttons.component';
import { DbNgxButtonModule } from '../../button/button.module';
import { DbNgxPopupCoordinatorService } from './popup.coordinator.service';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbNgxButtonModule,
    DbNgxAnchorModule,
    DbNgxActionModule,
    NgOverlayContainerModule
  ],
  declarations: [
    DbNgxPopupComponent,
    DbNgxPopupCoordinatorComponent,
    DbNgxPopupContentComponent,
    DbNgxPopupControlsComponent,
    DbNgxPopupControlButtonsComponent
  ],
  exports: [
    DbNgxPopupContentComponent,
    DbNgxPopupControlsComponent,
    DbNgxPopupControlButtonsComponent
  ],
  providers: [
    DbNgxPopupService
  ]
})
export class DbNgxPopupModule {

  static forRoot(): ModuleWithProviders<DbNgxPopupModule> {
    return {
      ngModule: DbNgxPopupModule,
      providers: [
        DbNgxPopupCoordinatorService
      ]
    };
  }

}
