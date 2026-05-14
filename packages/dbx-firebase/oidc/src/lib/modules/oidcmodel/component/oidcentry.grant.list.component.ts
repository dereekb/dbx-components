import { type DocumentDataWithIdAndKey, type OidcEntryGrantPayloadData, type OidcEntry } from '@dereekb/firebase';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractDbxSelectionListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  AbstractDbxSelectionListViewDirective,
  type DbxSelectionValueListViewConfig,
  provideDbxListView,
  provideDbxListViewWrapper,
  DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DbxSelectionValueListViewComponentImportsModule,
  DbxListWrapperComponentImportsModule,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  DbxButtonComponent,
  DbxActionConfirmDirective,
  type DbxActionConfirmConfig,
  DbxSpacerDirective
} from '@dereekb/dbx-web';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';

/**
 * Wrapper list of {@link OidcEntry} Grant rows belonging to the current user.
 *
 * Renders one row per Grant — i.e. one row per "app with access to my account" —
 * with an inline Revoke button that cascades through every grantable token.
 */
@Component({
  selector: 'dbx-firebase-oidc-grant-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseOidcEntryGrantListComponent),
  standalone: true,
  host: {
    class: 'dbx-list-no-hover-effects dbx-list-card-items-list'
  },
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryGrantListComponent extends AbstractDbxSelectionListWrapperDirective<OidcEntry> {
  constructor() {
    super({
      componentClass: DbxFirebaseOidcEntryGrantListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-firebase-oidc-grant-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseOidcEntryGrantListViewComponent),
  standalone: true,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryGrantListViewComponent extends AbstractDbxSelectionListViewDirective<OidcEntry> {
  readonly config: DbxSelectionValueListViewConfig<OidcEntry & { key: string; itemValue: OidcEntry }> = {
    componentClass: DbxFirebaseOidcEntryGrantListViewItemComponent,
    mapValuesToItemValues: (x) =>
      of(
        x.map((y, i) => {
          const id = (y as unknown as DocumentDataWithIdAndKey<OidcEntry>).id;
          return { ...y, key: id ?? `grant_${i}`, itemValue: y };
        })
      )
  };
}

// MARK: Item
/**
 * Per-row view for a Grant entry. Inline "Revoke" button uses a per-component
 * {@link OidcEntryDocumentStore} keyed to this entry's id so calling
 * `deleteToken` invokes the {@link DeleteOidcTokenParams} callModel against
 * the right document.
 */
@Component({
  selector: 'dbx-firebase-oidc-grant-list-view-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-item-padded-thick dbx-list-two-line-item">
      <div class="item-left">
        <span class="item-title">{{ clientIdSignal() }}</span>
        @if (scopeSignal()) {
          <span class="item-details">{{ scopeSignal() }}</span>
        }
        @if (expiresAtSignal()) {
          <span class="item-details-footnote">Expires {{ expiresAtSignal() | date: 'medium' }}</span>
        }
      </div>
      <dbx-spacer></dbx-spacer>
      <div class="item-right">
        <dbx-button dbxAction [dbxActionHandler]="handleRevoke" [dbxActionConfirm]="revokeConfirmConfig" dbxActionButton text="Revoke" icon="block" color="warn" [raised]="true"></dbx-button>
      </div>
    </div>
  `,
  standalone: true,
  imports: [DatePipe, DbxSpacerDirective, DbxButtonComponent, DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionConfirmDirective],
  providers: [OidcEntryDocumentStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryGrantListViewItemComponent extends AbstractDbxValueListViewItemComponent<OidcEntry> {
  readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);

  readonly clientIdSignal = computed(() => this._payload().clientId ?? '');
  readonly scopeSignal = computed(() => this._payload().openid?.scope ?? null);
  readonly expiresAtSignal = computed(() => this.itemValue.expiresAt ?? null);

  readonly revokeConfirmConfig: DbxActionConfirmConfig = {
    title: 'Revoke access',
    prompt: 'This app will lose access to your account immediately. Existing access and refresh tokens stop working.',
    confirmText: 'Revoke'
  };

  readonly handleRevoke: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.deleteToken({}));
  };

  constructor() {
    super();
    const id = (this.itemValue as unknown as DocumentDataWithIdAndKey<OidcEntry>).id;

    if (id) {
      this.oidcEntryDocumentStore.setId(id);
    }
  }

  private _payload(): Partial<OidcEntryGrantPayloadData> {
    return this.itemValue.payload ?? {};
  }
}
