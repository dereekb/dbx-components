import { Component } from '@angular/core';
import { of } from 'rxjs';
import { AbstractDbxListWrapperDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxValueListGridViewConfig, AbstractDbxValueListViewItemComponent, provideDbxListView, DbxValueAsListItem, AbstractDbxListGridViewDirective, DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE } from '../../layout/list';
import { DbxWidgetDataPair } from './widget';

export type DbxWidgetDataPairWithSelection = DbxValueAsListItem<DbxWidgetDataPair>;

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'dbx-widget-grid',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DbxWidgetListGridComponent extends AbstractDbxListWrapperDirective<DbxWidgetDataPair> {
  constructor() {
    super({
      componentClass: DbxWidgetListGridViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-widget-grid-view',
  template: DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DbxWidgetListGridViewComponent)
})
export class DbxWidgetListGridViewComponent extends AbstractDbxListGridViewDirective<DbxWidgetDataPair> {
  readonly config: DbxValueListGridViewConfig<DbxWidgetDataPairWithSelection> = {
    grid: {
      // TODO: Make configurable.
      columns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '8px'
    },
    componentClass: DbxWidgetListGridViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, itemValue: y })))
  };
}

@Component({
  template: `
    <dbx-widget-view [config]="itemValue"></dbx-widget-view>
  `
})
export class DbxWidgetListGridViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxWidgetDataPair> {}
