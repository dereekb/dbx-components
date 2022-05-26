import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { DbxFilterPopoverButtonComponent } from './filter.popover.button.component';
import { DbxPopoverInteractionModule } from '../popover/popover.module';
import { DbxFilterPopoverComponent } from './filter.popover.component';
import { MatIconModule } from '@angular/material/icon';
import { DbxFilterWrapperComponent } from './filter.wrapper.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { DbxCoreFilterModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    CommonModule,
    DbxPopoverInteractionModule,
    DbxCoreFilterModule,
    DbxInjectionComponentModule,
    FlexLayoutModule,
    // Material
    MatIconModule,
    MatButtonModule
  ],
  declarations: [DbxFilterPopoverComponent, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent],
  exports: [DbxCoreFilterModule, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent]
})
export class DbxFilterInteractionModule {}
