import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { AbstractDbxSelectionListViewDirective, AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, type DbxSelectionValueListViewConfig, provideDbxListView } from '@dereekb/dbx-web';
import { type OAuthConsentScope } from './oauth.consent.scope';

/**
 * Selection-list wrapper used as the `listComponentClass` for the OIDC
 * consent scope `dbxForgeListSelectionField`.
 *
 * Reuses the workspace's `dbx-list` selection infrastructure so the existing
 * scope-row visual treatment (name + description) remains intact while the
 * selection state participates in the surrounding `dbxAction`/`dbxActionForm`
 * pipeline.
 *
 * @example
 * ```ts
 * dbxForgeListSelectionField<OAuthConsentScope, DbxFirebaseOAuthConsentScopeListComponent, OidcScope>({
 *   key: 'grantedOIDCScopes',
 *   props: {
 *     listComponentClass: of(DbxFirebaseOAuthConsentScopeListComponent),
 *     readKey: (scope) => scope.name,
 *     state$: of(successResult(optionalScopes)),
 *     wrapped: false,
 *     maxHeight: 'none'
 *   }
 * });
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  host: {
    class: 'dbx-list-no-hover-effects dbx-list-card-items-list'
  },
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOAuthConsentScopeListComponent extends AbstractDbxSelectionListWrapperDirective<OAuthConsentScope> {
  constructor() {
    super({ componentClass: DbxFirebaseOAuthConsentScopeListViewComponent, defaultSelectionMode: 'select' });
  }
}

/**
 * Selection list view that pairs with `DbxFirebaseOAuthConsentScopeListComponent`.
 * Maps each `OAuthConsentScope` to a `DbxValueListItem` keyed by the scope name
 * and renders it through `DbxFirebaseOAuthConsentScopeListItemComponent`.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DbxFirebaseOAuthConsentScopeListViewComponent),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOAuthConsentScopeListViewComponent extends AbstractDbxSelectionListViewDirective<OAuthConsentScope> {
  readonly config: DbxSelectionValueListViewConfig<OAuthConsentScope> = {
    componentClass: DbxFirebaseOAuthConsentScopeListItemComponent,
    mapValuesToItemValues: (values) => of(values.map((scope) => ({ ...scope, key: scope.name, itemValue: scope })))
  };
}

/**
 * Item row inside the OIDC consent scope selection list. Shown as the visual
 * row for both selected and unselected scopes — the selection chrome (the
 * leading checkbox/highlight) is provided by the wrapping
 * `dbx-selection-list-view`.
 */
@Component({
  template: `
    <div class="dbx-list-item-padded dbx-list-item-padded-thick dbx-list-two-line-item">
      <div class="item-left">
        <div class="mat-subtitle-2">{{ name }}</div>
        @if (description) {
          <div class="item-details">{{ description }}</div>
        }
      </div>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthConsentScopeListItemComponent extends AbstractDbxValueListViewItemComponent<OAuthConsentScope> {
  get name() {
    return this.itemValue.name;
  }

  get description() {
    return this.itemValue.description;
  }
}
