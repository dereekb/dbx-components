import { DbNgxPopoverCoordinatorComponent } from './popover.coordinator.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxAnchorModule } from '../../nav/anchor/anchor.module';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbNgxPopoverService } from './popover.service';
import { DbNgxPopoverContentComponent } from './popover.content.component';
import { DbNgxPopoverComponent } from './popover.component';
import { DbNgxContentModule } from '../container/container.module';
import { DbNgxActionModule } from '../../action/action.module';
import { DbNgxPopoverControlsComponent } from './popover.controls.component';
import { DbNgxButtonModule } from '../../button/button.module';
import { DbNgxPopoverCoordinatorService } from './popover.coordinator.service';
import { DbNgxPopoverHeaderComponent } from './popover.header.component';
import { DbNgxPopoverScrollContentComponent } from './popover.scroll.content.component';
import { AngularResizedEventModule } from 'angular-resize-event';
import { MatDividerModule } from '@angular/material/divider';
import { DbNgxPopoverActionButtonDirective } from './popover.action.button.directive';
import { DbNgxPopoverActionDirective } from './popover.action.directive';
import { DbNgxKeypressModule } from '../../keys/keypress.module';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    DbNgxButtonModule,
    DbNgxAnchorModule,
    DbNgxContentModule,
    DbNgxActionModule,
    NgOverlayContainerModule,
    DbNgxKeypressModule,
    AngularResizedEventModule
  ],
  declarations: [
    DbNgxPopoverActionButtonDirective,
    DbNgxPopoverActionDirective,
    DbNgxPopoverComponent,
    DbNgxPopoverCoordinatorComponent,
    DbNgxPopoverContentComponent,
    DbNgxPopoverControlsComponent,
    DbNgxPopoverHeaderComponent,
    DbNgxPopoverScrollContentComponent
  ],
  exports: [
    DbNgxPopoverActionButtonDirective,
    DbNgxPopoverActionDirective,
    DbNgxPopoverContentComponent,
    DbNgxPopoverControlsComponent,
    DbNgxPopoverHeaderComponent,
    DbNgxPopoverScrollContentComponent
  ],
  providers: [
    DbNgxPopoverService
  ]
})
export class DbNgxPopoverModule {

  static forRoot(): ModuleWithProviders<DbNgxPopoverModule> {
    return {
      ngModule: DbNgxPopoverModule,
      providers: [
        DbNgxPopoverCoordinatorService
      ]
    };
  }

}
