import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, provideDbxListView, DbxValueAsListItem, provideDbxListViewWrapper, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';

export type DbxFirebaseModelTypeInstanceListItem = DbxValueAsListItem<DbxFirebaseModelTypesServiceInstancePair>;

/**
 * Renders an item as configured from the DbxFirebaseModelTypesServiceInstancePair.
 */
@Component({
  selector: 'dbx-firebase-model-type-instance-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListViewWrapper(DbxFirebaseModelTypeInstanceListComponent),
  standalone: true
})
export class DbxFirebaseModelTypeInstanceListComponent extends AbstractDbxSelectionListWrapperDirective<DbxFirebaseModelTypesServiceInstancePair> {
  constructor() {
    super({
      componentClass: DbxFirebaseModelTypeInstanceListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-firebase-model-type-instance-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListView(DbxFirebaseModelTypeInstanceListViewComponent),
  standalone: true
})
export class DbxFirebaseModelTypeInstanceListViewComponent extends AbstractDbxSelectionListViewDirective<DbxFirebaseModelTypesServiceInstancePair> {
  readonly config: DbxSelectionValueListViewConfig<DbxFirebaseModelTypeInstanceListItem> = {
    componentClass: DbxFirebaseModelTypeInstanceListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ itemValue: y, icon: y.displayInfo.icon ?? y.icon, anchor: y.segueRef })))
  };
}

@Component({
  template: `
    <span>{{ title }}</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelTypeInstanceListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseModelTypesServiceInstancePair> {
  readonly title = this.itemValue.displayInfo.title;
}
