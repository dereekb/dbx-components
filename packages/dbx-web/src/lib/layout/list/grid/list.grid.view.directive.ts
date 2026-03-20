import { Directive, NgModule } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListGridViewComponent, type DbxValueListGridViewConfig } from './list.grid.view.component';
import { type DbxValueAsListItem } from '../list.view.value';

/**
 * Default template string for grid list view components that renders a `dbx-list-grid-view` with a `config` binding.
 */
export const DEFAULT_DBX_LIST_GRID_VIEW_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>';

export const DBX_LIST_GRID_VIEW_COMPONENT_IMPORTS_AND_EXPORTS = [DbxValueListGridViewComponent];

/**
 * Convenience module that imports and exports {@link DbxValueListGridViewComponent}.
 */
@NgModule({
  exports: DBX_LIST_GRID_VIEW_COMPONENT_IMPORTS_AND_EXPORTS,
  imports: DBX_LIST_GRID_VIEW_COMPONENT_IMPORTS_AND_EXPORTS
})
export class DbxListGridViewComponentImportsModule {}

/**
 * Abstract base directive for grid-based list views. Extend this to create custom grid list views
 * that provide a {@link DbxValueListGridViewConfig}.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListGridViewConfig<DbxValueAsListItem<T>>;
}

// COMPAT: Deprecated aliases
/**
 * @deprecated use DBX_LIST_GRID_VIEW_COMPONENT_IMPORTS_AND_EXPORTS instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const dbxListGridViewComponentImportsAndExports = DBX_LIST_GRID_VIEW_COMPONENT_IMPORTS_AND_EXPORTS;
