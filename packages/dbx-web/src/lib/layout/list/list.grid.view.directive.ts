import { Directive } from '@angular/core';
import { AbstractDbxListViewDirective } from './list.view.directive';

export const DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE = '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>';

/**
 * Abstract DbxListGridView implementation.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {}
