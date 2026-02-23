import { Directive, NgModule } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListGridViewComponent, DbxValueListGridViewConfig } from './list.grid.view.component';
import { DbxValueAsListItem } from '../list.view.value';

export const DEFAULT_DBX_LIST_GRID_VIEW_DIRECTIVE_TEMPLATE = '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>';

export const dbxListGridViewDirectiveImportsAndExports = [DbxValueListGridViewComponent];

@NgModule({
  exports: dbxListGridViewDirectiveImportsAndExports,
  imports: dbxListGridViewDirectiveImportsAndExports
})
export class DbxListGridViewDirectiveImportsModule {}

/**
 * Abstract DbxListGridView implementation.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListGridViewConfig<DbxValueAsListItem<T>>;
}
