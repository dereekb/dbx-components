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
import { DbxButtonModule } from '../../button';
import { DbxPresetFilterListComponent } from './filter.preset.list.component';
import { DbxRouterAnchorListModule } from '../../router/layout/anchorlist/anchorlist.module';

@NgModule({
  imports: [
    CommonModule,
    DbxPopoverInteractionModule,
    DbxCoreFilterModule,
    DbxButtonModule,
    DbxRouterAnchorListModule,
    DbxInjectionComponentModule,
    FlexLayoutModule,
    // Material
    MatIconModule,
    MatButtonModule
  ],
  declarations: [DbxFilterPopoverComponent, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent, DbxPresetFilterListComponent],
  exports: [DbxCoreFilterModule, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent, DbxPresetFilterListComponent]
})
export class DbxFilterInteractionModule {}
