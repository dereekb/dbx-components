import { NgModule } from '@angular/core';
import { DbxFilterPopoverButtonComponent } from './filter.popover.button.component';
import { DbxFilterPopoverComponent } from './filter.popover.component';
import { DbxFilterWrapperComponent } from './filter.wrapper.component';
import { DbxCoreFilterModule } from '@dereekb/dbx-core';
import { DbxPresetFilterListComponent } from './filter.preset.list.component';
import { DbxPresetFilterMenuComponent } from './filter.preset.menu.component';
import { DbxPartialPresetFilterMenuComponent } from './filter.partial.menu.component';
import { DbxPartialPresetFilterListComponent } from './filter.partial.list.component';

const importsAndExports = [DbxPartialPresetFilterListComponent, DbxPartialPresetFilterMenuComponent, DbxFilterPopoverComponent, DbxFilterPopoverButtonComponent, DbxFilterWrapperComponent, DbxPresetFilterListComponent, DbxPresetFilterMenuComponent, DbxCoreFilterModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFilterInteractionModule {}
