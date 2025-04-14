import { Component, Directive, ChangeDetectionStrategy } from '@angular/core';
import { AbstractDbxListViewDirective } from '../list.view.directive';
import { DbxValueListGridViewComponent, DbxValueListGridViewConfig } from './list.grid.view.component';
import { DbxValueAsListItem } from '../list.view.value';

export const DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE_CONFIGURATION: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  template: '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>',
  imports: [DbxValueListGridViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
};

/**
 * Abstract DbxListGridView implementation.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {
  abstract readonly config: DbxValueListGridViewConfig<DbxValueAsListItem<T>>;
}

// MARK: Compat
/**
 * @deprecated
 */
export const DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE = DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE_CONFIGURATION.template;
