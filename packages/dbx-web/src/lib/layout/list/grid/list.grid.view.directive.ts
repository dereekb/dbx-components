import { Directive, NgModule } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListGridViewComponent, type DbxValueListGridViewConfig } from './list.grid.view.component';
import { type DbxValueAsListItem } from '../list.view.value';

export const DEFAULT_DBX_LIST_GRID_VIEW_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>';

export const dbxListGridViewComponentImportsAndExports = [DbxValueListGridViewComponent];

@NgModule({
  exports: dbxListGridViewComponentImportsAndExports,
  imports: dbxListGridViewComponentImportsAndExports
})
export class DbxListGridViewComponentImportsModule {}

/**
 * Abstract DbxListGridView implementation.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListGridViewConfig<DbxValueAsListItem<T>>;
}
