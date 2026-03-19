import { Directive, NgModule } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListAccordionViewComponent, type DbxValueListAccordionViewConfig } from './list.accordion.view.component';
import { type DbxValueAsListItem } from '../list.view.value';

/**
 * Default template string for accordion list view components that renders a `dbx-list-accordion-view` with a `config` binding.
 */
export const DEFAULT_DBX_LIST_ACCORDION_VIEW_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-list-accordion-view [config]="config"></dbx-list-accordion-view>';

export const DBX_LIST_ACCORDION_VIEW_COMPONENT_IMPORTS_AND_EXPORTS = [DbxValueListAccordionViewComponent];

/**
 * Convenience module that imports and exports {@link DbxValueListAccordionViewComponent}.
 */
@NgModule({
  exports: DBX_LIST_ACCORDION_VIEW_COMPONENT_IMPORTS_AND_EXPORTS,
  imports: DBX_LIST_ACCORDION_VIEW_COMPONENT_IMPORTS_AND_EXPORTS
})
export class DbxListAccordionViewComponentImportsModule {}

/**
 * Abstract base directive for accordion-based list views. Extend this to create custom accordion list views
 * that provide a {@link DbxValueListAccordionViewConfig}.
 */
@Directive()
export abstract class AbstractDbxListAccordionViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListAccordionViewConfig<DbxValueAsListItem<T>>;
}

// COMPAT: Deprecated aliases
/** @deprecated use DBX_LIST_ACCORDION_VIEW_COMPONENT_IMPORTS_AND_EXPORTS instead. */
export const dbxListAccordionViewComponentImportsAndExports = DBX_LIST_ACCORDION_VIEW_COMPONENT_IMPORTS_AND_EXPORTS;
