import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { DbxFilterPopoverButtonComponent } from './filter.popover.button.component';
import { DbxPopoverInteractionModule } from '../popover/popover.module';
import { DbxFilterPopoverComponent } from './filter.popover.component';
import { MatIconModule } from '@angular/material/icon';
import { DbxFilterWrapperComponent } from './filter.wrapper.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxCoreFilterModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxButtonModule } from '../../button';
import { DbxPresetFilterListComponent } from './filter.preset.list.component';
import { DbxRouterAnchorListModule } from '../../router/layout/anchorlist/anchorlist.module';
import { DbxPresetFilterMenuComponent } from './filter.preset.menu.component';
import { MatMenuModule } from '@angular/material/menu';
import { DbxRouterAnchorModule } from '../../router';
import { DbxPartialPresetFilterMenuComponent } from './filter.partial.menu.component';
import { DbxPartialPresetFilterListComponent } from './filter.partial.list.component';

const declarations = [DbxPartialPresetFilterListComponent, DbxPartialPresetFilterMenuComponent, DbxFilterPopoverComponent, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent, DbxPresetFilterListComponent, DbxPresetFilterMenuComponent];

@NgModule({
  imports: [
    CommonModule,
    DbxPopoverInteractionModule,
    DbxCoreFilterModule,
    DbxButtonModule,
    DbxRouterAnchorModule,
    DbxRouterAnchorListModule,
    DbxInjectionComponentModule,
    FlexLayoutModule,
    // Material
    MatMenuModule,
    MatIconModule,
    MatButtonModule
  ],
  declarations,
  exports: [...declarations, DbxCoreFilterModule]
})
export class DbxFilterInteractionModule {}
