import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AngularResizeEventModule } from 'angular-resize-event-package';
import { MatDividerModule } from '@angular/material/divider';
import { NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbxPopoverCoordinatorComponent } from './popover.coordinator.component';
import { DbxPopoverComponent } from './popover.component';
import { DbxKeypressModule } from '../../keypress';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';
import { DbxPopoverInteractionContentModule } from './popover.content.module';
import { DbxActionPopoverDirective } from './popover.action.directive';

// , CommonModule, MatIconModule, MatButtonModule, MatDividerModule, DbxKeypressModule, DbxStyleLayoutModule, DbxInjectionComponentModule, NgOverlayContainerModule, AngularResizeEventModule, DbxPopoverInteractionContentModule

const importsAndExports = [DbxPopoverComponent, DbxPopoverCoordinatorComponent, DbxActionPopoverDirective, DbxPopoverInteractionContentModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPopoverInteractionModule {}
