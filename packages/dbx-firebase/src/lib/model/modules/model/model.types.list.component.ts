import { Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';

export type DbxFirestoreModelTypeInstanceItem = DbxValueAsListItem<DbxFirebaseModelTypesServiceInstancePair>;

@Component({
  selector: 'dbx-firebase-model-type-instance-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseModelTypeInstanceComponent)
})
export class DbxFirebaseModelTypeInstanceComponent extends AbstractDbxSelectionListWrapperDirective<DbxFirebaseModelTypesServiceInstancePair> {
  constructor() {
    super({
      componentClass: DbxFirebaseModelTypeInstanceViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseModelTypeInstanceViewComponent)
})
export class DbxFirebaseModelTypeInstanceViewComponent extends AbstractDbxSelectionListViewDirective<DbxFirebaseModelTypesServiceInstancePair> {
  readonly config: DbxSelectionValueListViewConfig<DbxFirestoreModelTypeInstanceItem> = {
    componentClass: DbxFirebaseModelTypeInstanceViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div>
      <p>{{ title }}</p>
    </div>
  `
})
export class DbxFirebaseModelTypeInstanceViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseModelTypesServiceInstancePair> {
  get title() {
    return this.itemValue.displayInfo.title;
  }
}
