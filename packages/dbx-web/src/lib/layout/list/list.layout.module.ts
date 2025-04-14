import { NgModule } from '@angular/core';
import { DbxListComponent } from './list.component';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { DbxSelectionValueListViewContentComponent, DbxSelectionValueListViewComponent } from './list.view.value.selection.component';
import { DbxValueListViewContentComponent, DbxValueListViewComponent, DbxValueListViewContentGroupComponent } from './list.view.value.component';
import { DbxValueListGridViewContentComponent, DbxValueListGridSizeDirective, DbxValueListGridViewComponent } from './grid/list.grid.view.component';
import { DbxListModifierModule } from './modifier/list.modifier.module';
import { DbxListTitleGroupDirective } from './group';

const importsAndExports = [
  // modules
  DbxListModifierModule,
  // components/directives
  DbxListEmptyContentComponent,
  DbxListComponent,
  DbxValueListViewComponent,
  DbxValueListViewContentComponent,
  DbxValueListViewContentGroupComponent,
  DbxValueListGridSizeDirective,
  DbxValueListGridViewComponent,
  DbxValueListGridViewContentComponent,
  DbxListTitleGroupDirective,
  DbxSelectionValueListViewComponent,
  DbxSelectionValueListViewContentComponent
];

/**
 * @deprecated Import the standalone modules instead or DbxListModule.
 *
 * @see DbxListModule
 * @see DbxListComponent
 * @see DbxListEmptyContentComponent
 * @see DbxValueListViewComponent
 * @see DbxValueListViewContentComponent
 * @see DbxValueListViewContentGroupComponent
 * @see DbxValueListGridSizeDirective
 * @see DbxValueListGridViewComponent
 * @see DbxValueListGridViewContentComponent
 * @see DbxListViewMetaIconComponent
 * @see DbxListTitleGroupDirective
 * @see DbxListTitleGroupHeaderComponent
 * @see DbxSelectionValueListViewComponent
 * @see DbxSelectionValueListViewContentComponent
 * @see DbxValueListItemModifierDirective
 * @see DbxListItemDisableRippleModifierDirective
 * @see DbxListItemIsSelectedModifierDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxListLayoutModule {}
