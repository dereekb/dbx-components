import { Directive, NgModule } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListAccordionViewComponent, DbxValueListAccordionViewConfig } from './list.accordion.view.component';
import { DbxValueAsListItem } from '../list.view.value';

export const DEFAULT_DBX_LIST_ACCORDION_VIEW_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-list-accordion-view [config]="config"></dbx-list-accordion-view>';

export const dbxListAccordionViewComponentImportsAndExports = [DbxValueListAccordionViewComponent];

@NgModule({
  exports: dbxListAccordionViewComponentImportsAndExports,
  imports: dbxListAccordionViewComponentImportsAndExports
})
export class DbxListAccordionViewComponentImportsModule {}

/**
 * Abstract DbxListAccordionView implementation.
 */
@Directive()
export abstract class AbstractDbxListAccordionViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListAccordionViewConfig<DbxValueAsListItem<T>>;
}
