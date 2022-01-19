import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AngularResizeEventModule } from 'angular-resize-event';
import { MatDividerModule } from '@angular/material/divider';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbNgxPopoverCoordinatorComponent } from './popover.coordinator.component';
import { DbNgxPopoverService } from './popover.service';
import { DbNgxPopoverContentComponent } from './popover.content.component';
import { DbNgxPopoverComponent } from './popover.component';
import { DbNgxPopoverControlsComponent } from './popover.controls.component';
import { DbNgxPopoverCoordinatorService } from './popover.coordinator.service';
import { DbNgxPopoverHeaderComponent } from './popover.header.component';
import { DbNgxPopoverScrollContentComponent } from './popover.scroll.content.component';
import { DbNgxPopoverActionButtonDirective } from './popover.action.button.directive';
import { DbNgxPopoverActionDirective } from './popover.action.directive';
import { DbNgxKeypressModule } from '../../keypress';
import { DbNgxAnchorModule } from '../../router';
import { DbNgxActionModule } from '../../action/action.module';
import { DbNgxButtonModule } from '../../button/button.module';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    DbNgxButtonModule,
    DbNgxAnchorModule,
    DbNgxActionModule,
    DbNgxKeypressModule,
    NgOverlayContainerModule,
    AngularResizeEventModule
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
