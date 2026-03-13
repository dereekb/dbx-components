import { OIDC_ENTRY_CLIENT_TYPE, type OidcEntry } from '@dereekb/firebase';
import { Component, input } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, type DbxSelectionValueListViewConfig, provideDbxListView, type DbxValueAsListItem, provideDbxListViewWrapper, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE } from '@dereekb/dbx-web';
import { of } from 'rxjs';

export type OidcEntryWithSelection = DbxValueAsListItem<OidcEntry>;

@Component({
  selector: 'dbx-firebase-oidc-client-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseOidcEntryClientListComponent),
  standalone: true,
  imports: [DbxListWrapperComponentImportsModule]
})
export class DbxFirebaseOidcEntryClientListComponent extends AbstractDbxSelectionListWrapperDirective<OidcEntry> {
  constructor() {
    super({
      componentClass: DbxFirebaseOidcEntryClientListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-firebase-oidc-client-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseOidcEntryClientListViewComponent),
  standalone: true,
  imports: [DbxSelectionValueListViewComponentImportsModule]
})
export class DbxFirebaseOidcEntryClientListViewComponent extends AbstractDbxSelectionListViewDirective<OidcEntry> {
  readonly config: DbxSelectionValueListViewConfig<OidcEntryWithSelection> = {
    componentClass: DbxFirebaseOidcEntryClientListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, itemValue: y })))
  };
}

// MARK: Item List
@Component({
  selector: 'dbx-firebase-oidc-client-list-view-item-client',
  template: `
    <div>
      <p>{{ name }}</p>
      <p class="dbx-hint">{{ clientId }}</p>
    </div>
  `,
  standalone: true
})
export class DbxFirebaseOidcEntryClientListViewItemClientComponent {
  readonly entry = input.required<OidcEntry>();

  get name(): string {
    const payload = this.entry().payload as Record<string, unknown>;
    return (payload?.['client_name'] as string) || 'OAuth Client';
  }

  get clientId(): string {
    const payload = this.entry().payload as Record<string, unknown>;
    return (payload?.['client_id'] as string) || '';
  }
}

@Component({
  selector: 'dbx-firebase-oidc-client-list-view-item-default',
  template: `
    <div>
      <p>{{ entry().type }}</p>
    </div>
  `,
  standalone: true
})
export class DbxFirebaseOidcEntryClientListViewItemDefaultComponent {
  readonly entry = input.required<OidcEntry>();
}

@Component({
  template: `
    @switch (itemValue.type) {
      @case (clientType) {
        <dbx-firebase-oidc-client-list-view-item-client [entry]="itemValue"></dbx-firebase-oidc-client-list-view-item-client>
      }
      @default {
        <dbx-firebase-oidc-client-list-view-item-default [entry]="itemValue"></dbx-firebase-oidc-client-list-view-item-default>
      }
    }
  `,
  standalone: true,
  imports: [DbxFirebaseOidcEntryClientListViewItemClientComponent, DbxFirebaseOidcEntryClientListViewItemDefaultComponent]
})
export class DbxFirebaseOidcEntryClientListViewItemComponent extends AbstractDbxValueListViewItemComponent<OidcEntry> {
  readonly clientType = OIDC_ENTRY_CLIENT_TYPE;
}
