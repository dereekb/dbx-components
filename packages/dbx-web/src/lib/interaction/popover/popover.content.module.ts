import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AngularResizeEventModule } from 'angular-resize-event-package';
import { MatDividerModule } from '@angular/material/divider';
import { NgModule } from '@angular/core';
import { NgOverlayContainerModule } from 'ng-overlay-container';
import { DbxPopoverContentComponent } from './popover.content.component';
import { DbxPopoverControlsDirective } from './popover.controls.directive';
import { DbxPopoverHeaderComponent } from './popover.header.component';
import { DbxPopoverScrollContentComponent } from './popover.scroll.content.component';
import { DbxKeypressModule } from '../../keypress';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';
import { DbxPopoverCloseButtonComponent } from './popover.close.component';

const declarations = [DbxPopoverContentComponent, DbxPopoverControlsDirective, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentComponent];

/**
 * Contains all popover content components, allowing other sibling dbx-web modules to use the directives without referencing the full popover module.
 */
@NgModule({
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, DbxKeypressModule, DbxStyleLayoutModule, DbxInjectionComponentModule, NgOverlayContainerModule, AngularResizeEventModule],
  declarations,
  exports: declarations
})
export class DbxPopoverInteractionContentModule {}
