import { OIDC_ENTRY_CLIENT_TYPE, type OidcEntry } from '@dereekb/firebase';
import { Component, input } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, type DbxSelectionValueListViewConfig, provideDbxListView, type DbxValueAsListItem, provideDbxListViewWrapper, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE } from '@dereekb/dbx-web';
import { of } from 'rxjs';

export type OidcEntryWithSelection = DbxValueAsListItem<OidcEntry>;

@Component({
  selector: 'dbx-oauth-client-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxOidcEntryClientListComponent),
  standalone: true,
  imports: [DbxListWrapperComponentImportsModule]
})
export class DbxOidcEntryClientListComponent extends AbstractDbxSelectionListWrapperDirective<OidcEntry> {
  constructor() {
    super({
      componentClass: DbxOidcEntryClientListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-oauth-client-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DbxOidcEntryClientListViewComponent),
  standalone: true,
  imports: [DbxSelectionValueListViewComponentImportsModule]
})
export class DbxOidcEntryClientListViewComponent extends AbstractDbxSelectionListViewDirective<OidcEntry> {
  readonly config: DbxSelectionValueListViewConfig<OidcEntryWithSelection> = {
    componentClass: DbxOidcEntryClientListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, itemValue: y })))
  };
}

// MARK: Item List
@Component({
  selector: 'dbx-oauth-client-list-view-item-client',
  template: `
    <div>
      <p>{{ name }}</p>
      <p class="dbx-hint">{{ clientId }}</p>
    </div>
  `,
  standalone: true
})
export class DbxOidcEntryClientListViewItemClientComponent {
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
  selector: 'dbx-oauth-client-list-view-item-default',
  template: `
    <div>
      <p>{{ entry().type }}</p>
    </div>
  `,
  standalone: true
})
export class DbxOidcEntryClientListViewItemDefaultComponent {
  readonly entry = input.required<OidcEntry>();
}

@Component({
  template: `
    @switch (itemValue.type) {
      @case (clientType) {
        <dbx-oauth-client-list-view-item-client [entry]="itemValue"></dbx-oauth-client-list-view-item-client>
      }
      @default {
        <dbx-oauth-client-list-view-item-default [entry]="itemValue"></dbx-oauth-client-list-view-item-default>
      }
    }
  `,
  standalone: true,
  imports: [DbxOidcEntryClientListViewItemClientComponent, DbxOidcEntryClientListViewItemDefaultComponent]
})
export class DbxOidcEntryClientListViewItemComponent extends AbstractDbxValueListViewItemComponent<OidcEntry> {
  readonly clientType = OIDC_ENTRY_CLIENT_TYPE;
}
