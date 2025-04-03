import { NgModule } from '@angular/core';
import { DbxPopoverCoordinatorComponent } from './popover.coordinator.component';
import { DbxPopoverComponent } from './popover.component';
import { DbxPopoverInteractionContentModule } from './popover.content.module';
import { DbxActionPopoverDirective } from './popover.action.directive';

const importsAndExports = [DbxPopoverComponent, DbxPopoverCoordinatorComponent, DbxActionPopoverDirective, DbxPopoverInteractionContentModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPopoverInteractionModule {}
