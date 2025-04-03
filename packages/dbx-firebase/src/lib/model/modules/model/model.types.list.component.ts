import { Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';

export type DbxFirebaseModelTypeInstanceListItem = DbxValueAsListItem<DbxFirebaseModelTypesServiceInstancePair>;

/**
 * Renders an item as configured from the DbxFirebaseModelTypesServiceInstancePair.
 */
@Component({
  selector: 'dbx-firebase-model-type-instance-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.template,
  imports: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.imports,
  changeDetection: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.changeDetection,
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.template,
  imports: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.imports,
  changeDetection: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION.changeDetection,
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
  `
})
export class DbxFirebaseModelTypeInstanceListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseModelTypesServiceInstancePair> {
  readonly title = this.itemValue.displayInfo.title;
}
