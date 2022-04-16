import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AngularResizeEventModule } from 'angular-resize-event';
import { MatDividerModule } from '@angular/material/divider';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbxPopoverCoordinatorComponent } from './popover.coordinator.component';
import { DbxPopoverService } from './popover.service';
import { DbxPopoverContentComponent } from './popover.content.component';
import { DbxPopoverComponent } from './popover.component';
import { DbxPopoverControlsDirective } from './popover.controls.directive';
import { DbxPopoverHeaderComponent } from './popover.header.component';
import { DbxPopoverScrollContentComponent } from './popover.scroll.content.component';
import { DbxActionPopoverDirective } from './popover.action.directive';
import { DbxKeypressModule } from '../../keypress';
import { DbxAnchorModule } from '../../router';
import { DbxActionModule } from '../../action/action.module';
import { DbxButtonModule } from '../../button/button.module';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    DbxButtonModule,
    DbxAnchorModule,
    DbxActionModule,
    DbxKeypressModule,
    DbxStyleLayoutModule,
    DbxInjectionComponentModule,
    NgOverlayContainerModule,
    AngularResizeEventModule
  ],
  declarations: [
    DbxActionPopoverDirective,
    DbxPopoverComponent,
    DbxPopoverCoordinatorComponent,
    DbxPopoverContentComponent,
    DbxPopoverControlsDirective,
    DbxPopoverHeaderComponent,
    DbxPopoverScrollContentComponent
  ],
  exports: [
    DbxActionPopoverDirective,
    DbxPopoverContentComponent,
    DbxPopoverControlsDirective,
    DbxPopoverHeaderComponent,
    DbxPopoverScrollContentComponent
  ],
  providers: [
    DbxPopoverService
  ]
})
export class DbxPopoverInteractionModule { }
