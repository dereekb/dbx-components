import { NgModule } from '@angular/core';
import { DbxListComponent } from './list.component';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { DbxSelectionValueListViewContentComponent, DbxSelectionValueListViewComponent } from './list.view.value.selection.component';
import { DbxValueListViewContentComponent, DbxValueListViewComponent, DbxValueListViewContentGroupComponent } from './list.view.value.component';
import { DbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { DbxListItemDisableRippleModifierDirective } from './list.view.value.modifier.ripple.directive';
import { DbxValueListGridViewContentComponent, DbxValueListGridSizeDirective, DbxValueListGridViewComponent } from './list.grid.view.component';
import { DbxListItemIsSelectedModifierDirective } from './list.view.value.modifier.selection.directive';
import { DbxListTitleGroupDirective, DbxListTitleGroupHeaderComponent } from './list.view.value.group.title.directive';
import { DbxListViewMetaIconComponent } from './list.view.meta.icon.component';

const importsAndExports = [
  // directives
  DbxListComponent,
  DbxListEmptyContentComponent,
  DbxValueListViewComponent,
  DbxValueListViewContentComponent,
  DbxValueListViewContentGroupComponent,
  DbxValueListGridSizeDirective,
  DbxValueListGridViewComponent,
  DbxValueListGridViewContentComponent,
  DbxListViewMetaIconComponent,
  DbxListTitleGroupDirective,
  DbxListTitleGroupHeaderComponent,
  DbxSelectionValueListViewComponent,
  DbxSelectionValueListViewContentComponent,
  DbxValueListItemModifierDirective,
  DbxListItemDisableRippleModifierDirective,
  DbxListItemIsSelectedModifierDirective
];

/**
 * @deprecated Import the standalone modules instead.
 *
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
