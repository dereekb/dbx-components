import { NgModule } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';
import { DbxPopoverControlsDirective } from './popover.controls.directive';
import { DbxPopoverHeaderComponent } from './popover.header.component';
import { DbxPopoverScrollContentComponent } from './popover.scroll.content.component';
import { DbxPopoverCloseButtonComponent } from './popover.close.component';

const importsAndExports = [DbxPopoverContentComponent, DbxPopoverControlsDirective, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentComponent];

/**
 * Contains all popover content components, allowing other sibling dbx-web modules to use the directives without referencing the full popover module.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPopoverInteractionContentModule {}
