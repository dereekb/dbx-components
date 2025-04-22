import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { DbxWidgetDataPair } from './widget';
import { DbxWidgetViewComponent } from './widget.component';
import { AbstractDbxValueListViewItemComponent } from '../../layout/list/list.view.value.item.directive';
import { DbxValueAsListItem } from '../../layout/list/list.view.value';
import { AbstractDbxListGridViewDirective, DbxListGridViewDirectiveImportsModule, DEFAULT_DBX_LIST_GRID_VIEW_DIRECTIVE_TEMPLATE } from '../../layout/list/grid/list.grid.view.directive';
import { DbxValueListGridViewConfig } from '../../layout/list/grid/list.grid.view.component';
import { provideDbxListView } from '../../layout/list/list.view';
import { AbstractDbxListWrapperDirective, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE } from '../../layout/list/list.directive';

export type DbxWidgetDataPairWithSelection = DbxValueAsListItem<DbxWidgetDataPair>;

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'dbx-widget-grid',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
  template: DEFAULT_DBX_LIST_GRID_VIEW_DIRECTIVE_TEMPLATE,
  imports: [DbxListGridViewDirectiveImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
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
  `,
  imports: [DbxWidgetViewComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxWidgetListGridViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxWidgetDataPair> {}
