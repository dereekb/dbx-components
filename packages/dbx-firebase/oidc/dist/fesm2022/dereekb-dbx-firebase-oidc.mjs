import * as i0 from '@angular/core';
import { input, computed, output, ChangeDetectionStrategy, Component, inject, Injectable, signal, effect, Directive, provideAppInitializer, makeEnvironmentProviders } from '@angular/core';
import * as i1$1 from '@dereekb/dbx-web';
import {
  DbxBasicLoadingComponent,
  DbxErrorComponent,
  DbxButtonComponent,
  DbxAvatarComponent,
  DbxLoadingComponent,
  DbxButtonSpacerDirective,
  AbstractDbxSelectionListWrapperDirective,
  DbxListWrapperComponentImportsModule,
  provideDbxListViewWrapper,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  AbstractDbxSelectionListViewDirective,
  DbxSelectionValueListViewComponentImportsModule,
  provideDbxListView,
  DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  AbstractDbxValueListViewItemComponent,
  DbxActionSnackbarErrorDirective,
  DbxContentPitDirective,
  DbxDetailBlockComponent,
  DbxClickToCopyTextComponent,
  DbxActionConfirmDirective
} from '@dereekb/dbx-web';
import { readableError, SPACE_STRING_SPLIT_JOIN, separateValues, generatePkceCodeVerifier, generatePkceCodeChallenge } from '@dereekb/util';
import { DbxInjectionComponent, DBX_INJECTION_COMPONENT_DATA, DbxRouterService, dbxRouteParamReaderInstance, completeOnDestroy, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxAppAuthRouterService } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseAuthService, AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreUpdateFunction, firebaseDocumentStoreDeleteFunction, AbstractDbxFirebaseCollectionStore, DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective, DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { HttpClient } from '@angular/common/http';
import { first, switchMap, of, map, BehaviorSubject, tap } from 'rxjs';
import * as i1 from '@dereekb/dbx-form';
import { dbxForgeValueSelectionField, dbxForgeTextField, dbxForgeSearchableStringChipField, isWebsiteUrlValidator, dbxForgeContainer, dbxForgePickableChipField, pickableValueFieldValuesConfigForStaticLabeledValues, AbstractConfigAsyncForgeFormDirective, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxActionFormDirective, DbxFormSourceDirective, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS, PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD, OIDC_ENTRY_CLIENT_TYPE, OidcModelFunctions, OidcModelFirestoreCollections } from '@dereekb/firebase';
import { CommonModule } from '@angular/common';

/**
 * Presentational component for the OIDC OAuth login interaction.
 *
 * Renders the login UI based on the current state case. Supports ng-content
 * projection to allow apps to provide a custom login view for the `'no_user'` state,
 * falling back to the default `<dbx-firebase-login>` component.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-login-view [loginStateCase]="'no_user'">
 *   <my-custom-login />
 * </dbx-firebase-oauth-login-view>
 * ```
 */
class DbxFirebaseOAuthLoginViewComponent {
  loginStateCase = input.required(...(ngDevMode ? [{ debugName: 'loginStateCase' }] : /* istanbul ignore next */ []));
  error = input(...(ngDevMode ? [undefined, { debugName: 'error' }] : /* istanbul ignore next */ []));
  resolvedError = computed(
    () => {
      const error = this.error();
      return typeof error === 'string' ? readableError('ERROR', error) : error;
    },
    ...(ngDevMode ? [{ debugName: 'resolvedError' }] : /* istanbul ignore next */ [])
  );
  retryClick = output();
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOAuthLoginViewComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOAuthLoginViewComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-login-view',
    inputs: { loginStateCase: { classPropertyName: 'loginStateCase', publicName: 'loginStateCase', isSignal: true, isRequired: true, transformFunction: null }, error: { classPropertyName: 'error', publicName: 'error', isSignal: true, isRequired: false, transformFunction: null } },
    outputs: { retryClick: 'retryClick' },
    host: { classAttribute: 'd-block dbx-firebase-oauth-login-view' },
    ngImport: i0,
    template: `
    <div class="dbx-firebase-oauth-login-view">
      @switch (loginStateCase()) {
        @case ('no_user') {
          <ng-content></ng-content>
        }
        @case ('user') {
          <dbx-basic-loading [loading]="true" text="Signing in..."></dbx-basic-loading>
        }
        @case ('submitting') {
          <dbx-basic-loading [loading]="true" text="Submitting authentication..."></dbx-basic-loading>
        }
        @case ('error') {
          <dbx-button text="Retry" [raised]="true" (buttonClick)="retryClick.emit()"></dbx-button>
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
      }
    </div>
  `,
    isInline: true,
    dependencies: [
      { kind: 'component', type: DbxBasicLoadingComponent, selector: 'dbx-basic-loading', inputs: ['diameter', 'mode', 'color', 'text', 'linear', 'show', 'loading', 'error'] },
      { kind: 'component', type: DbxErrorComponent, selector: 'dbx-error', inputs: ['error', 'iconOnly'], outputs: ['popoverOpened'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOAuthLoginViewComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-login-view',
          standalone: true,
          imports: [DbxBasicLoadingComponent, DbxErrorComponent, DbxButtonComponent],
          template: `
    <div class="dbx-firebase-oauth-login-view">
      @switch (loginStateCase()) {
        @case ('no_user') {
          <ng-content></ng-content>
        }
        @case ('user') {
          <dbx-basic-loading [loading]="true" text="Signing in..."></dbx-basic-loading>
        }
        @case ('submitting') {
          <dbx-basic-loading [loading]="true" text="Submitting authentication..."></dbx-basic-loading>
        }
        @case ('error') {
          <dbx-button text="Retry" [raised]="true" (buttonClick)="retryClick.emit()"></dbx-button>
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
      }
    </div>
  `,
          host: {
            class: 'd-block dbx-firebase-oauth-login-view'
          },
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ],
  propDecorators: { loginStateCase: [{ type: i0.Input, args: [{ isSignal: true, alias: 'loginStateCase', required: true }] }], error: [{ type: i0.Input, args: [{ isSignal: true, alias: 'error', required: false }] }], retryClick: [{ type: i0.Output, args: ['retryClick'] }] }
});

/**
 * Presentational component for the OIDC OAuth consent screen.
 *
 * Accepts an `OAuthInteractionLoginDetails` input that contains all client and scope
 * information. Renders the client name, logo, client URL, scopes (via `<dbx-injection>`),
 * error/loading states, and approve/deny action buttons.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-view
 *   [details]="loginDetails"
 *   [loading]="false"
 *   [scopeInjectionConfig]="scopeConfig"
 *   (approveClick)="onApprove()"
 *   (denyClick)="onDeny()">
 * </dbx-firebase-oauth-consent-view>
 * ```
 */
class DbxFirebaseOAuthConsentViewComponent {
  details = input(...(ngDevMode ? [undefined, { debugName: 'details' }] : /* istanbul ignore next */ []));
  loading = input(false, ...(ngDevMode ? [{ debugName: 'loading' }] : /* istanbul ignore next */ []));
  error = input(...(ngDevMode ? [undefined, { debugName: 'error' }] : /* istanbul ignore next */ []));
  scopeInjectionConfig = input.required(...(ngDevMode ? [{ debugName: 'scopeInjectionConfig' }] : /* istanbul ignore next */ []));
  clientName = computed(() => this.details()?.client_name ?? '', ...(ngDevMode ? [{ debugName: 'clientName' }] : /* istanbul ignore next */ []));
  clientUri = computed(() => this.details()?.client_uri, ...(ngDevMode ? [{ debugName: 'clientUri' }] : /* istanbul ignore next */ []));
  logoUri = computed(() => this.details()?.logo_uri, ...(ngDevMode ? [{ debugName: 'logoUri' }] : /* istanbul ignore next */ []));
  scopes = computed(() => SPACE_STRING_SPLIT_JOIN.splitStrings(this.details()?.scopes ?? ''), ...(ngDevMode ? [{ debugName: 'scopes' }] : /* istanbul ignore next */ []));
  resolvedError = computed(
    () => {
      const error = this.error();
      return typeof error === 'string' ? readableError('ERROR', error) : error;
    },
    ...(ngDevMode ? [{ debugName: 'resolvedError' }] : /* istanbul ignore next */ [])
  );
  approveClick = output();
  denyClick = output();
  resolvedScopeInjectionConfig = computed(
    () => {
      const data = {
        details: this.details(),
        scopes: this.scopes(),
        clientName: this.clientName()
      };
      return { ...this.scopeInjectionConfig(), data };
    },
    ...(ngDevMode ? [{ debugName: 'resolvedScopeInjectionConfig' }] : /* istanbul ignore next */ [])
  );
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOAuthConsentViewComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOAuthConsentViewComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-consent-view',
    inputs: {
      details: { classPropertyName: 'details', publicName: 'details', isSignal: true, isRequired: false, transformFunction: null },
      loading: { classPropertyName: 'loading', publicName: 'loading', isSignal: true, isRequired: false, transformFunction: null },
      error: { classPropertyName: 'error', publicName: 'error', isSignal: true, isRequired: false, transformFunction: null },
      scopeInjectionConfig: { classPropertyName: 'scopeInjectionConfig', publicName: 'scopeInjectionConfig', isSignal: true, isRequired: true, transformFunction: null }
    },
    outputs: { approveClick: 'approveClick', denyClick: 'denyClick' },
    host: { classAttribute: 'd-block dbx-firebase-oauth-consent-view' },
    ngImport: i0,
    template: `
    <div class="dbx-firebase-oauth-consent-view">
      @if (loading()) {
        <dbx-loading [loading]="true" text="Processing..."></dbx-loading>
      } @else {
        <div class="dbx-firebase-oauth-consent-header">
          @if (clientName()) {
            <h2>You're signing in to {{ clientName() }}</h2>
          }
          <div class="dbx-firebase-oauth-consent-header-info dbx-flex">
            <dbx-avatar [avatarUrl]="logoUri()" [avatarStyle]="'square'" avatarIcon="apps"></dbx-avatar>
            <span>
              @if (clientUri()) {
                <a class="dbx-firebase-oauth-consent-client-uri" [href]="clientUri()" target="_blank" rel="noopener noreferrer">{{ clientUri() }}</a>
              }
            </span>
          </div>
        </div>
        <dbx-injection [config]="resolvedScopeInjectionConfig()"></dbx-injection>
        <div class="dbx-pt3 dbx-pb3 dbx-firebase-oauth-consent-actions">
          <dbx-button text="Approve" [raised]="true" color="primary" (buttonClick)="approveClick.emit()"></dbx-button>
          <dbx-button-spacer></dbx-button-spacer>
          <dbx-button text="Deny" [flat]="true" color="warn" (buttonClick)="denyClick.emit()"></dbx-button>
        </div>
        @if (resolvedError()) {
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
      }
    </div>
  `,
    isInline: true,
    styles: ['.dbx-firebase-oauth-consent-view .dbx-firebase-oauth-consent-header-info{align-items:center;gap:12px}\n'],
    dependencies: [
      { kind: 'component', type: DbxInjectionComponent, selector: 'dbx-injection, [dbxInjection], [dbx-injection]', inputs: ['config', 'template'] },
      { kind: 'component', type: DbxAvatarComponent, selector: 'dbx-avatar', inputs: ['context', 'avatarSelector', 'avatarUid', 'avatarUrl', 'avatarKey', 'avatarIcon', 'avatarStyle', 'avatarSize', 'avatarHideOnError'] },
      { kind: 'component', type: DbxLoadingComponent, selector: 'dbx-loading', inputs: ['padding', 'show', 'text', 'mode', 'color', 'diameter', 'linear', 'loading', 'error', 'context'] },
      { kind: 'component', type: DbxErrorComponent, selector: 'dbx-error', inputs: ['error', 'iconOnly'], outputs: ['popoverOpened'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] },
      { kind: 'directive', type: DbxButtonSpacerDirective, selector: 'dbx-button-spacer,[dbxButtonSpacer]' }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOAuthConsentViewComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-consent-view',
          standalone: true,
          imports: [DbxInjectionComponent, DbxAvatarComponent, DbxLoadingComponent, DbxErrorComponent, DbxButtonComponent, DbxButtonSpacerDirective],
          template: `
    <div class="dbx-firebase-oauth-consent-view">
      @if (loading()) {
        <dbx-loading [loading]="true" text="Processing..."></dbx-loading>
      } @else {
        <div class="dbx-firebase-oauth-consent-header">
          @if (clientName()) {
            <h2>You're signing in to {{ clientName() }}</h2>
          }
          <div class="dbx-firebase-oauth-consent-header-info dbx-flex">
            <dbx-avatar [avatarUrl]="logoUri()" [avatarStyle]="'square'" avatarIcon="apps"></dbx-avatar>
            <span>
              @if (clientUri()) {
                <a class="dbx-firebase-oauth-consent-client-uri" [href]="clientUri()" target="_blank" rel="noopener noreferrer">{{ clientUri() }}</a>
              }
            </span>
          </div>
        </div>
        <dbx-injection [config]="resolvedScopeInjectionConfig()"></dbx-injection>
        <div class="dbx-pt3 dbx-pb3 dbx-firebase-oauth-consent-actions">
          <dbx-button text="Approve" [raised]="true" color="primary" (buttonClick)="approveClick.emit()"></dbx-button>
          <dbx-button-spacer></dbx-button-spacer>
          <dbx-button text="Deny" [flat]="true" color="warn" (buttonClick)="denyClick.emit()"></dbx-button>
        </div>
        @if (resolvedError()) {
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
      }
    </div>
  `,
          host: {
            class: 'd-block dbx-firebase-oauth-consent-view'
          },
          changeDetection: ChangeDetectionStrategy.OnPush,
          styles: ['.dbx-firebase-oauth-consent-view .dbx-firebase-oauth-consent-header-info{align-items:center;gap:12px}\n']
        }
      ]
    }
  ],
  propDecorators: {
    details: [{ type: i0.Input, args: [{ isSignal: true, alias: 'details', required: false }] }],
    loading: [{ type: i0.Input, args: [{ isSignal: true, alias: 'loading', required: false }] }],
    error: [{ type: i0.Input, args: [{ isSignal: true, alias: 'error', required: false }] }],
    scopeInjectionConfig: [{ type: i0.Input, args: [{ isSignal: true, alias: 'scopeInjectionConfig', required: true }] }],
    approveClick: [{ type: i0.Output, args: ['approveClick'] }],
    denyClick: [{ type: i0.Output, args: ['denyClick'] }]
  }
});

/**
 * Abstract base class for consent scope view components.
 *
 * Provides typed access to the `DbxFirebaseOAuthConsentScopesViewData` injected
 * via `DBX_INJECTION_COMPONENT_DATA`. Subclasses only need to define a template.
 *
 * @example
 * ```typescript
 * @Component({ template: `...` })
 * export class MyCustomScopesViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {}
 * ```
 */
class AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  data = inject(DBX_INJECTION_COMPONENT_DATA);
  details = computed(() => this.data?.details, ...(ngDevMode ? [{ debugName: 'details' }] : /* istanbul ignore next */ []));
  scopes = computed(() => this.data?.scopes ?? [], ...(ngDevMode ? [{ debugName: 'scopes' }] : /* istanbul ignore next */ []));
  clientName = computed(() => this.data?.clientName ?? '', ...(ngDevMode ? [{ debugName: 'clientName' }] : /* istanbul ignore next */ []));
  clientUri = computed(() => this.data?.details?.client_uri, ...(ngDevMode ? [{ debugName: 'clientUri' }] : /* istanbul ignore next */ []));
  logoUri = computed(() => this.data?.details?.logo_uri, ...(ngDevMode ? [{ debugName: 'logoUri' }] : /* istanbul ignore next */ []));
}

/**
 * Standalone presentational component that renders a list of OAuth consent scopes.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes"></dbx-firebase-oauth-consent-scope-list>
 * ```
 */
class DbxFirebaseOAuthConsentScopeListComponent {
  scopes = input([], ...(ngDevMode ? [{ debugName: 'scopes' }] : /* istanbul ignore next */ []));
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOAuthConsentScopeListComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOAuthConsentScopeListComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-consent-scope-list',
    inputs: { scopes: { classPropertyName: 'scopes', publicName: 'scopes', isSignal: true, isRequired: false, transformFunction: null } },
    ngImport: i0,
    template: `
    @for (scope of scopes(); track scope.name) {
      <div class="dbx-firebase-oauth-consent-scope-list-item dbx-mb2">
        <span class="dbx-firebase-oauth-consent-scope-name dbx-pb2">{{ scope.name }}</span>
        @if (scope.description) {
          <span class="dbx-firebase-oauth-consent-scope-description">{{ scope.description }}</span>
        }
      </div>
    }
  `,
    isInline: true,
    styles: ['.dbx-firebase-oauth-consent-scope-list-item{display:flex;flex-direction:column;padding:8px 12px;border-left:3px solid var(--dbx-primary-color);background:color-mix(in srgb,var(--dbx-color-current) 10%,transparent)}.dbx-firebase-oauth-consent-scope-list-item .dbx-firebase-oauth-consent-scope-name{font-weight:500}.dbx-firebase-oauth-consent-scope-list-item .dbx-firebase-oauth-consent-scope-description{font-size:.85em;opacity:.7}\n'],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOAuthConsentScopeListComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-consent-scope-list',
          standalone: true,
          template: `
    @for (scope of scopes(); track scope.name) {
      <div class="dbx-firebase-oauth-consent-scope-list-item dbx-mb2">
        <span class="dbx-firebase-oauth-consent-scope-name dbx-pb2">{{ scope.name }}</span>
        @if (scope.description) {
          <span class="dbx-firebase-oauth-consent-scope-description">{{ scope.description }}</span>
        }
      </div>
    }
  `,
          changeDetection: ChangeDetectionStrategy.OnPush,
          styles: ['.dbx-firebase-oauth-consent-scope-list-item{display:flex;flex-direction:column;padding:8px 12px;border-left:3px solid var(--dbx-primary-color);background:color-mix(in srgb,var(--dbx-color-current) 10%,transparent)}.dbx-firebase-oauth-consent-scope-list-item .dbx-firebase-oauth-consent-scope-name{font-weight:500}.dbx-firebase-oauth-consent-scope-list-item .dbx-firebase-oauth-consent-scope-description{font-size:.85em;opacity:.7}\n']
        }
      ]
    }
  ],
  propDecorators: { scopes: [{ type: i0.Input, args: [{ isSignal: true, alias: 'scopes', required: false }] }] }
});

const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';
const DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH = '/interaction';
const DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY = 'uid';
const DEFAULT_OIDC_CLIENT_ID_PARAM_KEY = 'client_id';
const DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY = 'client_name';
const DEFAULT_OIDC_CLIENT_URI_PARAM_KEY = 'client_uri';
const DEFAULT_OIDC_LOGO_URI_PARAM_KEY = 'logo_uri';
const DEFAULT_OIDC_SCOPES_PARAM_KEY = 'scopes';
const DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS = ['client_secret_post', 'client_secret_basic'];
/**
 * Abstract configuration class used as a DI token for app-level OIDC settings.
 *
 * Apps provide a concrete implementation via `provideDbxFirebaseOidc()`.
 */
class DbxFirebaseOidcConfig {
  /**
   * Path to the authorization endpoint. Defaults to '/oidc/auth'.
   */
  oidcAuthorizationEndpointApiPath;
  /**
   * Base path for interaction endpoints. Defaults to '/interaction'.
   */
  oidcInteractionEndpointApiPath;
  /**
   * Supported token endpoint authentication methods.
   *
   * Overrides the default methods (`client_secret_post`, `client_secret_basic`).
   * Used by forms and UI components that need to know which auth methods are available.
   */
  tokenEndpointAuthMethods;
  /**
   * Frontend route ref for the OAuth interaction pages (login/consent).
   *
   * When provided, this route is registered with {@link DbxAppAuthRouterService} as an
   * ignored route, preventing auth effects from redirecting away during the OIDC flow.
   *
   * Uses hierarchical matching — a parent route ref (e.g., `'app.oauth'`) will cover
   * all child routes (e.g., `'app.oauth.login'`, `'app.oauth.consent'`).
   */
  oauthInteractionRoute;
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, uses `DbxFirebaseOAuthConsentScopeDefaultViewComponent` which
   * maps scope names to descriptions from `availableScopes`.
   */
  consentScopeListViewClass;
}
/**
 * Service that exposes the app-level OIDC configuration.
 *
 * Inject this service in components to access centralized OIDC settings
 * (scopes, endpoint paths, param keys, etc.) without requiring explicit inputs.
 */
class DbxFirebaseOidcConfigService {
  config = inject(DbxFirebaseOidcConfig);
  get availableScopes() {
    return this.config.availableScopes;
  }
  get oidcAuthorizationEndpointApiPath() {
    return this.config.oidcAuthorizationEndpointApiPath ?? DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH;
  }
  get oidcInteractionEndpointApiPath() {
    return this.config.oidcInteractionEndpointApiPath ?? DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH;
  }
  get tokenEndpointAuthMethods() {
    return this.config.tokenEndpointAuthMethods ?? DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
  }
  get oauthInteractionRoute() {
    return this.config.oauthInteractionRoute;
  }
  get consentScopeListViewClass() {
    return this.config.consentScopeListViewClass;
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcConfigService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
  static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcConfigService });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcConfigService,
  decorators: [
    {
      type: Injectable
    }
  ]
});

/**
 * Default consent scope view component that maps scope names to descriptions
 * using the `OidcScopeDetails` from the app-level OIDC configuration.
 *
 * Apps can override this by providing a custom `consentScopeListViewClass`
 * in `DbxFirebaseOidcConfig` or `DbxOAuthConsentComponentConfig`.
 */
class DbxFirebaseOAuthConsentScopeDefaultViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  oidcConfigService = inject(DbxFirebaseOidcConfigService);
  mappedScopes = computed(
    () => {
      const availableScopes = this.oidcConfigService.availableScopes;
      const availableScopeValues = new Set(availableScopes.map((s) => s.value));
      const { included: knownScopes, excluded: unknownScopes } = separateValues(this.scopes(), (name) => availableScopeValues.has(name));
      return [
        ...knownScopes.map((name) => {
          const details = availableScopes.find((s) => s.value === name);
          return { name, description: details?.description ?? '' };
        }),
        ...unknownScopes.map((name) => ({ name, description: 'unknown' }))
      ];
    },
    ...(ngDevMode ? [{ debugName: 'mappedScopes' }] : /* istanbul ignore next */ [])
  );
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOAuthConsentScopeDefaultViewComponent, deps: null, target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOAuthConsentScopeDefaultViewComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-consent-scope-default-view',
    usesInheritance: true,
    ngImport: i0,
    template: `
    <p>
      <strong>{{ clientName() }}</strong>
      is requesting these permissions:
    </p>
    <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes()"></dbx-firebase-oauth-consent-scope-list>
  `,
    isInline: true,
    dependencies: [{ kind: 'component', type: DbxFirebaseOAuthConsentScopeListComponent, selector: 'dbx-firebase-oauth-consent-scope-list', inputs: ['scopes'] }],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOAuthConsentScopeDefaultViewComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-consent-scope-default-view',
          standalone: true,
          imports: [DbxFirebaseOAuthConsentScopeListComponent],
          template: `
    <p>
      <strong>{{ clientName() }}</strong>
      is requesting these permissions:
    </p>
    <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes()"></dbx-firebase-oauth-consent-scope-list>
  `,
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ]
});

// MARK: Service
/**
 * Service for communicating with the backend OIDC interaction endpoints.
 *
 * Automatically includes the current user's Firebase Auth ID token
 * with each request for server-side verification.
 *
 * After successful login/consent submission, the server returns a redirect URL.
 * The component is responsible for navigating to it (e.g., via `window.location.href`).
 */
class DbxFirebaseOidcInteractionService {
  http = inject(HttpClient);
  _authService = inject(DbxFirebaseAuthService);
  _oidcConfig = inject(DbxFirebaseOidcConfigService);
  /**
   * Base URL for the interaction API, derived from the OIDC config service.
   *
   * @returns The base URL string for the OIDC interaction endpoint.
   */
  get baseUrl() {
    return this._oidcConfig.oidcInteractionEndpointApiPath;
  }
  /**
   * Submit login to complete the login interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @param uid - The OIDC interaction UID identifying the current login interaction.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitLogin(uid) {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => this.http.post(`${this.baseUrl}/${uid}/login`, { idToken }))
    );
  }
  /**
   * Submit consent decision to complete the consent interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @param uid - The OIDC interaction UID identifying the current consent interaction.
   * @param approved - Whether the user approved or denied the consent request.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitConsent(uid, approved) {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => this.http.post(`${this.baseUrl}/${uid}/consent`, { idToken, approved }))
    );
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcInteractionService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
  static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcInteractionService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcInteractionService,
  decorators: [
    {
      type: Injectable,
      args: [{ providedIn: 'root' }]
    }
  ]
});

/**
 * Container component for the OIDC OAuth login interaction flow.
 *
 * Manages all state: route param reading, Firebase Auth observation, ID token
 * submission, and error handling. Delegates visual rendering to
 * `DbxFirebaseOAuthLoginViewComponent`.
 *
 * Supports ng-content projection — any content provided is passed through to
 * the view component, replacing the default `<dbx-firebase-login>` for the
 * `'no_user'` state.
 *
 * Usage: Route to this component with `?uid=<interaction-uid>` query param.
 */
class DbxFirebaseOAuthLoginComponent {
  dbxRouterService = inject(DbxRouterService);
  dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  interactionService = inject(DbxFirebaseOidcInteractionService);
  uidParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY);
  interactionUid = toSignal(this.uidParamReader.value$);
  isLoggedIn = toSignal(this.dbxFirebaseAuthService.isLoggedIn$, { initialValue: false });
  submitting = signal(false, ...(ngDevMode ? [{ debugName: 'submitting' }] : /* istanbul ignore next */ []));
  errorMessage = signal(null, ...(ngDevMode ? [{ debugName: 'errorMessage' }] : /* istanbul ignore next */ []));
  loginStateCase = computed(
    () => {
      if (this.submitting()) {
        return 'submitting';
      }
      if (this.errorMessage()) {
        return 'error';
      }
      if (!this.isLoggedIn()) {
        return 'no_user';
      }
      return 'user';
    },
    ...(ngDevMode ? [{ debugName: 'loginStateCase' }] : /* istanbul ignore next */ [])
  );
  constructor() {
    // Auto-submit when user is logged in
    effect(() => {
      if (this.loginStateCase() === 'user') {
        this._submitIdToken();
      }
    });
  }
  ngOnDestroy() {
    this.uidParamReader.destroy();
  }
  retry() {
    this.errorMessage.set(null);
    this._submitIdToken();
  }
  _submitIdToken() {
    const uid = this.interactionUid();
    if (!uid) {
      this.errorMessage.set('Missing interaction UID from route parameters.');
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.interactionService.submitLogin(uid).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (response.redirectTo) {
          window.location.href = response.redirectTo;
        }
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Failed to complete login. Please try again.');
      }
    });
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOAuthLoginComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOAuthLoginComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-login',
    host: { classAttribute: 'd-block dbx-firebase-oauth-login' },
    ngImport: i0,
    template: `
    <dbx-firebase-oauth-login-view [loginStateCase]="loginStateCase()" [error]="errorMessage()" (retryClick)="retry()">
      <ng-content />
    </dbx-firebase-oauth-login-view>
  `,
    isInline: true,
    dependencies: [{ kind: 'component', type: DbxFirebaseOAuthLoginViewComponent, selector: 'dbx-firebase-oauth-login-view', inputs: ['loginStateCase', 'error'], outputs: ['retryClick'] }],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOAuthLoginComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-login',
          standalone: true,
          imports: [DbxFirebaseOAuthLoginViewComponent],
          template: `
    <dbx-firebase-oauth-login-view [loginStateCase]="loginStateCase()" [error]="errorMessage()" (retryClick)="retry()">
      <ng-content />
    </dbx-firebase-oauth-login-view>
  `,
          host: {
            class: 'd-block dbx-firebase-oauth-login'
          },
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ],
  ctorParameters: () => []
});

/**
 * Container component for the OIDC OAuth consent screen.
 *
 * Manages all state: route param reading, consent submission, and error handling.
 * Delegates visual rendering to `DbxFirebaseOAuthConsentViewComponent`.
 *
 * Reads interaction UID and client details from route params (populated by
 * the server redirect), then assembles them into `OAuthInteractionLoginDetails`.
 */
class DbxOAuthConsentComponent {
  dbxRouterService = inject(DbxRouterService);
  interactionService = inject(DbxFirebaseOidcInteractionService);
  oidcConfigService = inject(DbxFirebaseOidcConfigService);
  // Config input
  config = input(...(ngDevMode ? [undefined, { debugName: 'config' }] : /* istanbul ignore next */ []));
  // Route param readers
  interactionUidParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY);
  clientIdParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_CLIENT_ID_PARAM_KEY);
  clientNameParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY);
  clientUriParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_CLIENT_URI_PARAM_KEY);
  logoUriParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_LOGO_URI_PARAM_KEY);
  scopesParamReader = dbxRouteParamReaderInstance(this.dbxRouterService, DEFAULT_OIDC_SCOPES_PARAM_KEY);
  // Signals from route params
  routeUid = toSignal(this.interactionUidParamReader.value$);
  routeClientId = toSignal(this.clientIdParamReader.value$);
  routeClientName = toSignal(this.clientNameParamReader.value$);
  routeClientUri = toSignal(this.clientUriParamReader.value$);
  routeLogoUri = toSignal(this.logoUriParamReader.value$);
  routeScopes = toSignal(this.scopesParamReader.value$);
  // Resolved values
  resolvedInteractionUid = computed(() => this.routeUid(), ...(ngDevMode ? [{ debugName: 'resolvedInteractionUid' }] : /* istanbul ignore next */ []));
  resolvedDetails = computed(
    () => {
      const client_id = this.routeClientId() ?? '';
      const client_name = this.routeClientName();
      const client_uri = this.routeClientUri();
      const logo_uri = this.routeLogoUri();
      const scopes = this.routeScopes() ?? '';
      return {
        client_id,
        client_name,
        client_uri,
        logo_uri,
        scopes
      };
    },
    ...(ngDevMode ? [{ debugName: 'resolvedDetails' }] : /* istanbul ignore next */ [])
  );
  // Scope injection config: built from the configured scope list view class, falling back to config service, then the default
  scopeInjectionConfig = computed(
    () => ({
      componentClass: this.config()?.consentScopeListViewClass ?? this.oidcConfigService.consentScopeListViewClass ?? DbxFirebaseOAuthConsentScopeDefaultViewComponent
    }),
    ...(ngDevMode ? [{ debugName: 'scopeInjectionConfig' }] : /* istanbul ignore next */ [])
  );
  loading = signal(false, ...(ngDevMode ? [{ debugName: 'loading' }] : /* istanbul ignore next */ []));
  error = signal(null, ...(ngDevMode ? [{ debugName: 'error' }] : /* istanbul ignore next */ []));
  ngOnDestroy() {
    this.interactionUidParamReader.destroy();
    this.clientIdParamReader.destroy();
    this.clientNameParamReader.destroy();
    this.clientUriParamReader.destroy();
    this.logoUriParamReader.destroy();
    this.scopesParamReader.destroy();
  }
  approve() {
    this._submitConsent(true);
  }
  deny() {
    this._submitConsent(false);
  }
  _submitConsent(approved) {
    const uid = this.resolvedInteractionUid();
    if (!uid) {
      this.error.set('Missing interaction UID');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.interactionService.submitConsent(uid, approved).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.redirectTo) {
          window.location.href = response.redirectTo;
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to process consent. Please try again.');
      }
    });
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxOAuthConsentComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.1.0',
    version: '21.2.11',
    type: DbxOAuthConsentComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oauth-consent',
    inputs: { config: { classPropertyName: 'config', publicName: 'config', isSignal: true, isRequired: false, transformFunction: null } },
    host: { classAttribute: 'd-block dbx-firebase-oauth-consent' },
    ngImport: i0,
    template: `
    <dbx-firebase-oauth-consent-view [details]="resolvedDetails()" [loading]="loading()" [error]="error()" [scopeInjectionConfig]="scopeInjectionConfig()" (approveClick)="approve()" (denyClick)="deny()"></dbx-firebase-oauth-consent-view>
  `,
    isInline: true,
    dependencies: [{ kind: 'component', type: DbxFirebaseOAuthConsentViewComponent, selector: 'dbx-firebase-oauth-consent-view', inputs: ['details', 'loading', 'error', 'scopeInjectionConfig'], outputs: ['approveClick', 'denyClick'] }],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxOAuthConsentComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oauth-consent',
          standalone: true,
          imports: [DbxFirebaseOAuthConsentViewComponent],
          template: `
    <dbx-firebase-oauth-consent-view [details]="resolvedDetails()" [loading]="loading()" [error]="error()" [scopeInjectionConfig]="scopeInjectionConfig()" (approveClick)="approve()" (denyClick)="deny()"></dbx-firebase-oauth-consent-view>
  `,
          host: {
            class: 'd-block dbx-firebase-oauth-consent'
          },
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ],
  propDecorators: { config: [{ type: i0.Input, args: [{ isSignal: true, alias: 'config', required: false }] }] }
});

/**
 * Creates forge fields for the OAuth client create form.
 *
 * Includes `token_endpoint_auth_method` which is immutable after creation.
 *
 * @param config - Optional configuration for field generation, including mode and allowed auth methods.
 * @returns A FormConfig for the client creation form.
 */
function oidcEntryClientForgeFormFields(config) {
  const fields = [];
  if (config?.mode === 'create') {
    fields.push(oidcClientTokenEndpointAuthMethodForgeField(config));
  }
  fields.push(...oidcEntryClientUpdateForgeFormFields());
  return { fields };
}
/**
 * Creates a forge value selection field for choosing the token endpoint authentication method.
 *
 * @param config - Optional configuration to filter the available auth method options.
 * @returns A forge value selection field for the token endpoint auth method selector.
 */
function oidcClientTokenEndpointAuthMethodForgeField(config) {
  const allowedAuthMethods = config?.tokenEndpointAuthMethods;
  const options = allowedAuthMethods?.length ? ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.filter((o) => allowedAuthMethods.includes(o.value)) : ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS;
  return dbxForgeValueSelectionField({
    key: 'token_endpoint_auth_method',
    label: 'Token Endpoint Auth Method',
    description: 'How the client authenticates when exchanging tokens. Cannot be changed after creation.',
    required: true,
    props: { options }
  });
}
/**
 * Creates forge fields for updating an existing OAuth client.
 *
 * Excludes `token_endpoint_auth_method` (immutable after creation).
 *
 * @returns Array of forge field definitions for the client update form.
 */
function oidcEntryClientUpdateForgeFormFields() {
  return [oidcClientNameForgeField(), oidcClientRedirectUrisForgeField(), oidcClientJwksUriForgeField(), oidcClientLogoUriForgeField(), oidcClientHomepageUriForgeField()];
}
/**
 * Creates a forge text field for the OAuth client display name.
 *
 * @returns A forge text field for the client name.
 */
function oidcClientNameForgeField() {
  return dbxForgeTextField({
    key: 'client_name',
    label: 'Client Name',
    hint: 'A human-readable name for this OAuth client.',
    required: true,
    maxLength: 200
  });
}
/**
 * Creates a forge searchable chip field for entering redirect URIs.
 *
 * @returns A forge searchable chip field for redirect URIs.
 */
function oidcClientRedirectUrisForgeField() {
  return dbxForgeSearchableStringChipField({
    key: 'redirect_uris',
    label: 'Redirect URIs',
    hint: 'Type a redirect URI (e.g. https://example.com/callback) and press enter to add it.',
    required: true,
    props: {
      searchOnEmptyText: false,
      textInputValidator: isWebsiteUrlValidator({ requirePrefix: true, allowPorts: true }),
      search: () => of([]),
      displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
    }
  });
}
/**
 * Creates a forge container wrapping the JWKS URI field, conditionally hidden
 * when the token endpoint auth method is not `private_key_jwt`. A container
 * (not a group) is used so the `jwks_uri` field stays at the root level of
 * the form value rather than being nested under an extra object.
 *
 * @returns A forge container field with conditional visibility logic.
 */
function oidcClientJwksUriForgeField() {
  return dbxForgeContainer({
    key: 'jwks_uri_container',
    fields: [
      dbxForgeTextField({
        key: 'jwks_uri',
        label: 'JWKS URI',
        hint: "URL where the client's public JSON Web Key Set can be fetched. Required for private_key_jwt authentication.",
        logic: [
          {
            type: 'required',
            condition: {
              type: 'fieldValue',
              fieldPath: 'token_endpoint_auth_method',
              operator: 'equals',
              value: PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD
            }
          }
        ]
      })
    ],
    logic: [
      {
        type: 'hidden',
        condition: {
          type: 'fieldValue',
          fieldPath: 'token_endpoint_auth_method',
          operator: 'notEquals',
          value: PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD
        }
      }
    ]
  });
}
/**
 * Creates a forge text field for the optional client logo URL.
 *
 * @returns A forge text field for the logo URI.
 */
function oidcClientLogoUriForgeField() {
  return dbxForgeTextField({
    key: 'logo_uri',
    label: 'Logo URI',
    hint: 'URL of the client logo image (optional).',
    required: false
  });
}
/**
 * Creates a forge text field for the optional client homepage URL.
 *
 * @returns A forge text field for the homepage URL.
 */
function oidcClientHomepageUriForgeField() {
  return dbxForgeTextField({
    key: 'client_uri',
    label: 'Homepage URL',
    hint: 'URL of the client homepage (optional).',
    required: false
  });
}
/**
 * Assembles the forge form fields for the OAuth test client form.
 *
 * @param config - Configuration providing available redirect URIs and scopes for the test form.
 * @returns A FormConfig for the test client form.
 */
function oidcEntryClientTestForgeFormFields(config) {
  return { fields: [oidcClientTestClientIdForgeField(), oidcClientTestRedirectUriForgeField(config.redirectUris), oidcClientTestScopesForgeField(config.availableScopes)] };
}
/**
 * Creates a read-only forge text field displaying the OAuth client ID.
 *
 * @returns A read-only forge text field for the client ID.
 */
function oidcClientTestClientIdForgeField() {
  return dbxForgeTextField({
    key: 'client_id',
    label: 'Client ID',
    readonly: true
  });
}
/**
 * Creates a forge selection field for choosing one of the client's registered redirect URIs for testing.
 *
 * @param redirectUris - The registered redirect URIs to display as options.
 * @returns A forge selection field for the redirect URI.
 */
function oidcClientTestRedirectUriForgeField(redirectUris) {
  const options = redirectUris.map((uri) => ({ label: uri, value: uri }));
  return dbxForgeValueSelectionField({
    key: 'redirect_uri',
    label: 'Redirect URI',
    description: 'Select the redirect URI to use for the test flow.',
    required: true,
    props: { options }
  });
}
/**
 * Creates a forge pickable chip field for selecting scopes to request during the test flow.
 *
 * @param availableScopes - The available scopes to display as selectable options.
 * @returns A forge pickable chip field for scope selection.
 */
function oidcClientTestScopesForgeField(availableScopes) {
  return dbxForgePickableChipField({
    key: 'scopes',
    label: 'Scopes',
    hint: 'Select the scopes to request.',
    props: {
      showSelectAllButton: true,
      ...pickableValueFieldValuesConfigForStaticLabeledValues(availableScopes)
    }
  });
}

/**
 * Configurable forge form component for creating or updating an OAuth client.
 *
 * Pass `{ mode: 'create' }` to show all fields including `token_endpoint_auth_method`.
 * Pass `{ mode: 'update' }` to exclude `token_endpoint_auth_method` (immutable after creation).
 *
 * Token endpoint auth methods are pulled from the injected {@link DbxFirebaseOidcConfigService}.
 */
class DbxFirebaseOidcEntryClientForgeFormComponent extends AbstractConfigAsyncForgeFormDirective {
  _oidcConfigService = inject(DbxFirebaseOidcConfigService);
  formConfig$ = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }
      return oidcEntryClientForgeFormFields({
        ...config,
        tokenEndpointAuthMethods: this._oidcConfigService.tokenEndpointAuthMethods
      });
    })
  );
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientForgeFormComponent, deps: null, target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientForgeFormComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-forge-form',
    providers: dbxForgeFormComponentProviders(),
    usesInheritance: true,
    ngImport: i0,
    template: '<dbx-forge></dbx-forge>',
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: DbxForgeFormComponentImportsModule },
      { kind: 'component', type: i1.DbxForgeFormComponent, selector: 'dbx-forge' }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientForgeFormComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-forge-form',
          template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
          providers: dbxForgeFormComponentProviders(),
          imports: [DbxForgeFormComponentImportsModule],
          changeDetection: ChangeDetectionStrategy.OnPush,
          standalone: true
        }
      ]
    }
  ]
});

/**
 * Forge form component for configuring an OAuth test authorization request.
 *
 * Displays read-only client_id, a redirect URI selector, and scope picker.
 */
class DbxFirebaseOidcEntryClientTestForgeFormComponent extends AbstractConfigAsyncForgeFormDirective {
  formConfig$ = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }
      return oidcEntryClientTestForgeFormFields(config);
    })
  );
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientTestForgeFormComponent, deps: null, target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientTestForgeFormComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-test-forge-form',
    providers: dbxForgeFormComponentProviders(),
    usesInheritance: true,
    ngImport: i0,
    template: '<dbx-forge></dbx-forge>',
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: DbxForgeFormComponentImportsModule },
      { kind: 'component', type: i1.DbxForgeFormComponent, selector: 'dbx-forge' }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientTestForgeFormComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-test-forge-form',
          template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
          providers: dbxForgeFormComponentProviders(),
          imports: [DbxForgeFormComponentImportsModule],
          changeDetection: ChangeDetectionStrategy.OnPush,
          standalone: true
        }
      ]
    }
  ]
});

class DbxFirebaseOidcEntryClientListComponent extends AbstractDbxSelectionListWrapperDirective {
  constructor() {
    super({
      componentClass: DbxFirebaseOidcEntryClientListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientListComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientListComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-list',
    providers: provideDbxListViewWrapper(DbxFirebaseOidcEntryClientListComponent),
    usesInheritance: true,
    ngImport: i0,
    template: '\n  <dbx-list [state]="currentState$" [config]="configSignal()" [hasMore]="hasMore()" [disabled]="disabledSignal()" [selectionMode]="selectionModeSignal()">\n    <ng-content top select="[top]"></ng-content>\n    <ng-content bottom select="[bottom]"></ng-content>\n    <ng-content empty select="[empty]"></ng-content>\n    <ng-content emptyLoading select="[emptyLoading]"></ng-content>\n    <ng-content end select="[end]"></ng-content>\n  </dbx-list>',
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: DbxListWrapperComponentImportsModule },
      { kind: 'component', type: i1$1.DbxListComponent, selector: 'dbx-list', inputs: ['padded', 'state', 'config', 'disabled', 'selectionMode', 'hasMore'], outputs: ['contentScrolled'] }
    ]
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientListComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-list',
          template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
          providers: provideDbxListViewWrapper(DbxFirebaseOidcEntryClientListComponent),
          standalone: true,
          imports: [DbxListWrapperComponentImportsModule]
        }
      ]
    }
  ],
  ctorParameters: () => []
});
class DbxFirebaseOidcEntryClientListViewComponent extends AbstractDbxSelectionListViewDirective {
  config = {
    componentClass: DbxFirebaseOidcEntryClientListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y, i) => ({ ...y, key: `oidc_${i}`, itemValue: y })))
  };
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientListViewComponent, deps: null, target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientListViewComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-list-view',
    providers: provideDbxListView(DbxFirebaseOidcEntryClientListViewComponent),
    usesInheritance: true,
    ngImport: i0,
    template: '<dbx-selection-list-view [config]="config"></dbx-selection-list-view>',
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: DbxSelectionValueListViewComponentImportsModule },
      { kind: 'component', type: i1$1.DbxSelectionValueListViewComponent, selector: 'dbx-selection-list-view' }
    ]
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientListViewComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-list-view',
          template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
          providers: provideDbxListView(DbxFirebaseOidcEntryClientListViewComponent),
          standalone: true,
          imports: [DbxSelectionValueListViewComponentImportsModule]
        }
      ]
    }
  ]
});
// MARK: Item List
class DbxFirebaseOidcEntryClientListViewItemClientComponent {
  entry = input.required(...(ngDevMode ? [{ debugName: 'entry' }] : /* istanbul ignore next */ []));
  get name() {
    const payload = this.entry().payload;
    return payload?.client_name || 'OAuth Client';
  }
  get clientId() {
    const payload = this.entry().payload;
    return payload?.client_id || '';
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientListViewItemClientComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.1.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientListViewItemClientComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-list-view-item-client',
    inputs: { entry: { classPropertyName: 'entry', publicName: 'entry', isSignal: true, isRequired: true, transformFunction: null } },
    ngImport: i0,
    template: `
    <div>
      <p>{{ name }}</p>
      <p class="dbx-hint">{{ clientId }}</p>
    </div>
  `,
    isInline: true
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientListViewItemClientComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-list-view-item-client',
          template: `
    <div>
      <p>{{ name }}</p>
      <p class="dbx-hint">{{ clientId }}</p>
    </div>
  `,
          standalone: true
        }
      ]
    }
  ],
  propDecorators: { entry: [{ type: i0.Input, args: [{ isSignal: true, alias: 'entry', required: true }] }] }
});
class DbxFirebaseOidcEntryClientListViewItemDefaultComponent {
  entry = input.required(...(ngDevMode ? [{ debugName: 'entry' }] : /* istanbul ignore next */ []));
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientListViewItemDefaultComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.1.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientListViewItemDefaultComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-client-list-view-item-default',
    inputs: { entry: { classPropertyName: 'entry', publicName: 'entry', isSignal: true, isRequired: true, transformFunction: null } },
    ngImport: i0,
    template: `
    <div>
      <p>{{ entry().type }}</p>
    </div>
  `,
    isInline: true
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientListViewItemDefaultComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-client-list-view-item-default',
          template: `
    <div>
      <p>{{ entry().type }}</p>
    </div>
  `,
          standalone: true
        }
      ]
    }
  ],
  propDecorators: { entry: [{ type: i0.Input, args: [{ isSignal: true, alias: 'entry', required: true }] }] }
});
class DbxFirebaseOidcEntryClientListViewItemComponent extends AbstractDbxValueListViewItemComponent {
  clientType = OIDC_ENTRY_CLIENT_TYPE;
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientListViewItemComponent, deps: null, target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientListViewItemComponent,
    isStandalone: true,
    selector: 'ng-component',
    usesInheritance: true,
    ngImport: i0,
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
    isInline: true,
    dependencies: [
      { kind: 'component', type: DbxFirebaseOidcEntryClientListViewItemClientComponent, selector: 'dbx-firebase-oidc-client-list-view-item-client', inputs: ['entry'] },
      { kind: 'component', type: DbxFirebaseOidcEntryClientListViewItemDefaultComponent, selector: 'dbx-firebase-oidc-client-list-view-item-default', inputs: ['entry'] }
    ]
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientListViewItemComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
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
        }
      ]
    }
  ]
});

/**
 * Document store for a single {@link OidcEntry}.
 */
class OidcEntryDocumentStore extends AbstractDbxFirebaseDocumentStore {
  oidcModelFunctions = inject(OidcModelFunctions);
  _latestClientSecret$ = completeOnDestroy(new BehaviorSubject(undefined));
  /**
   * The client secret from the most recent create operation.
   *
   * Only available immediately after creation — the server does not return it again.
   */
  latestClientSecret$ = this._latestClientSecret$.asObservable();
  get latestClientSecret() {
    return this._latestClientSecret$.value;
  }
  constructor() {
    super({ firestoreCollection: inject(OidcModelFirestoreCollections).oidcEntryCollection });
  }
  createClient = firebaseDocumentStoreCreateFunction(this, this.oidcModelFunctions.oidcEntry.createOidcEntry.client, {
    onResult: (_params, result) => {
      this._latestClientSecret$.next(result.client_secret);
    }
  });
  updateClient = firebaseDocumentStoreUpdateFunction(this, this.oidcModelFunctions.oidcEntry.updateOidcEntry.client);
  rotateClientSecret = firebaseDocumentStoreUpdateFunction(this, this.oidcModelFunctions.oidcEntry.updateOidcEntry.rotateClientSecret, {
    onResult: (_params, result) => {
      this._latestClientSecret$.next(result.client_secret);
    }
  });
  deleteClient = firebaseDocumentStoreDeleteFunction(this, this.oidcModelFunctions.oidcEntry.deleteOidcEntry.client);
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryDocumentStore, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
  static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryDocumentStore });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: OidcEntryDocumentStore,
  decorators: [
    {
      type: Injectable
    }
  ],
  ctorParameters: () => []
});

/**
 * Container component for creating a new OAuth client.
 *
 * Wraps the client form in an action context with a submit button.
 * Emits {@link clientCreated} with the result after successful creation.
 */
class DbxFirebaseOidcEntryClientCreateComponent {
  oidcEntryDocumentStore = inject(OidcEntryDocumentStore);
  formConfig = { mode: 'create' };
  createClientOwnerTarget = input(...(ngDevMode ? [undefined, { debugName: 'createClientOwnerTarget' }] : /* istanbul ignore next */ []));
  clientCreated = output();
  handleCreateClient = (value, context) => {
    const params = value;
    const target = this.createClientOwnerTarget();
    if (target) {
      params.key = target;
    }
    context.startWorkingWithLoadingStateObservable(
      this.oidcEntryDocumentStore.createClient(params).pipe(
        tap((state) => {
          if (state.value) {
            this.clientCreated.emit(state.value);
          }
        })
      )
    );
  };
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientCreateComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.1.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientCreateComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-entry-client-create',
    inputs: { createClientOwnerTarget: { classPropertyName: 'createClientOwnerTarget', publicName: 'createClientOwnerTarget', isSignal: true, isRequired: false, transformFunction: null } },
    outputs: { clientCreated: 'clientCreated' },
    ngImport: i0,
    template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleCreateClient" dbxActionSnackbarError>
      <dbx-firebase-oidc-client-forge-form dbxActionForm [config]="formConfig"></dbx-firebase-oidc-client-forge-form>
      <dbx-button [raised]="true" dbxActionButton text="Create"></dbx-button>
    </div>
  `,
    isInline: true,
    dependencies: [
      { kind: 'directive', type: DbxActionSnackbarErrorDirective, selector: '[dbxActionSnackbarError]', inputs: ['dbxActionSnackbarError'] },
      { kind: 'directive', type: DbxActionDirective, selector: 'dbx-action,[dbxAction]', exportAs: ['action', 'dbxAction'] },
      { kind: 'directive', type: DbxActionEnforceModifiedDirective, selector: '[dbxActionEnforceModified]', inputs: ['dbxActionEnforceModified'] },
      { kind: 'directive', type: DbxActionHandlerDirective, selector: '[dbxActionHandler]', inputs: ['dbxActionHandler'] },
      { kind: 'directive', type: DbxActionFormDirective, selector: '[dbxActionForm]', inputs: ['dbxActionFormDisabledOnWorking', 'dbxActionFormIsValid', 'dbxActionFormIsEqual', 'dbxActionFormIsModified', 'dbxActionFormMapValue'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] },
      { kind: 'directive', type: DbxActionButtonDirective, selector: '[dbxActionButton]', inputs: ['dbxActionButtonEcho'] },
      { kind: 'component', type: DbxFirebaseOidcEntryClientForgeFormComponent, selector: 'dbx-firebase-oidc-client-forge-form' }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientCreateComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-entry-client-create',
          template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleCreateClient" dbxActionSnackbarError>
      <dbx-firebase-oidc-client-forge-form dbxActionForm [config]="formConfig"></dbx-firebase-oidc-client-forge-form>
      <dbx-button [raised]="true" dbxActionButton text="Create"></dbx-button>
    </div>
  `,
          standalone: true,
          imports: [DbxActionSnackbarErrorDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxFirebaseOidcEntryClientForgeFormComponent],
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ],
  propDecorators: { createClientOwnerTarget: [{ type: i0.Input, args: [{ isSignal: true, alias: 'createClientOwnerTarget', required: false }] }], clientCreated: [{ type: i0.Output, args: ['clientCreated'] }] }
});

/**
 * Container component for testing an OAuth authorization flow against a registered client.
 *
 * Displays a form with the client's ID, redirect URIs, and scopes,
 * then builds an authorization URL with PKCE parameters that can be opened in a new tab.
 */
class DbxFirebaseOidcEntryClientTestComponent {
  oidcEntryDocumentStore = inject(OidcEntryDocumentStore);
  oidcConfigService = inject(DbxFirebaseOidcConfigService);
  /**
   * Scopes the user can pick from. Overrides the service default when provided.
   */
  availableScopes = input(undefined, ...(ngDevMode ? [{ debugName: 'availableScopes' }] : /* istanbul ignore next */ []));
  /**
   * Path to the authorization endpoint. Overrides the service default when provided.
   */
  oidcAuthorizationEndpointApiPath = input(undefined, ...(ngDevMode ? [{ debugName: 'oidcAuthorizationEndpointApiPath' }] : /* istanbul ignore next */ []));
  resolvedAvailableScopes = computed(() => this.availableScopes() ?? this.oidcConfigService.availableScopes, ...(ngDevMode ? [{ debugName: 'resolvedAvailableScopes' }] : /* istanbul ignore next */ []));
  resolvedAuthorizationEndpointPath = computed(() => this.oidcAuthorizationEndpointApiPath() ?? this.oidcConfigService.oidcAuthorizationEndpointApiPath, ...(ngDevMode ? [{ debugName: 'resolvedAuthorizationEndpointPath' }] : /* istanbul ignore next */ []));
  // MARK: Derived Store Data
  redirectUrisSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => data.payload?.redirect_uris ?? [])));
  clientIdSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => data.payload?.client_id)));
  // MARK: Form Config
  formConfig = computed(
    () => {
      const redirectUris = this.redirectUrisSignal();
      const availableScopes = this.resolvedAvailableScopes();
      if (redirectUris) {
        return { redirectUris, availableScopes };
      }
      return undefined;
    },
    ...(ngDevMode ? [{ debugName: 'formConfig' }] : /* istanbul ignore next */ [])
  );
  formTemplate$ = this.oidcEntryDocumentStore.data$.pipe(
    map((data) => {
      const payload = data.payload;
      const formValue = {
        client_id: payload?.client_id ?? '',
        redirect_uri: payload?.redirect_uris?.[0] ?? '',
        scopes: ['openid']
      };
      return formValue;
    })
  );
  // MARK: PKCE
  codeVerifier = signal(generatePkceCodeVerifier(), ...(ngDevMode ? [{ debugName: 'codeVerifier' }] : /* istanbul ignore next */ []));
  codeChallenge = signal('', ...(ngDevMode ? [{ debugName: 'codeChallenge' }] : /* istanbul ignore next */ []));
  state = signal(generateRandomString(), ...(ngDevMode ? [{ debugName: 'state' }] : /* istanbul ignore next */ []));
  nonce = signal(generateRandomString(), ...(ngDevMode ? [{ debugName: 'nonce' }] : /* istanbul ignore next */ []));
  /**
   * The current form value, updated by the form via dbxFormValueChange.
   */
  formValue = signal(undefined, ...(ngDevMode ? [{ debugName: 'formValue' }] : /* istanbul ignore next */ []));
  authorizationUrlSignal = computed(
    () => {
      const clientId = this.clientIdSignal();
      const codeChallenge = this.codeChallenge();
      const state = this.state();
      const nonce = this.nonce();
      const formValue = this.formValue();
      if (!clientId || !codeChallenge || !formValue?.redirect_uri) {
        return undefined;
      }
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: formValue.redirect_uri,
        scope: (formValue.scopes ?? ['openid']).join(' '),
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      return `${this.resolvedAuthorizationEndpointPath()}?${params.toString()}`;
    },
    ...(ngDevMode ? [{ debugName: 'authorizationUrlSignal' }] : /* istanbul ignore next */ [])
  );
  constructor() {
    this._updateCodeChallenge();
  }
  onFormValueChange(value) {
    this.formValue.set(value);
  }
  openAuthorizationUrl() {
    const url = this.authorizationUrlSignal();
    if (url) {
      window.open(url, '_blank');
    }
  }
  regeneratePkce() {
    this.codeVerifier.set(generatePkceCodeVerifier());
    this.state.set(generateRandomString());
    this.nonce.set(generateRandomString());
    this._updateCodeChallenge();
  }
  _updateCodeChallenge() {
    void generatePkceCodeChallenge(this.codeVerifier()).then((challenge) => {
      this.codeChallenge.set(challenge);
    });
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientTestComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientTestComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-entry-client-test',
    inputs: { availableScopes: { classPropertyName: 'availableScopes', publicName: 'availableScopes', isSignal: true, isRequired: false, transformFunction: null }, oidcAuthorizationEndpointApiPath: { classPropertyName: 'oidcAuthorizationEndpointApiPath', publicName: 'oidcAuthorizationEndpointApiPath', isSignal: true, isRequired: false, transformFunction: null } },
    ngImport: i0,
    template: `
    @if (formConfig()) {
      <dbx-firebase-oidc-client-test-forge-form [dbxFormSource]="formTemplate$" dbxFormSourceMode="always" [config]="formConfig()" (dbxFormValueChange)="onFormValueChange($event)"></dbx-firebase-oidc-client-test-forge-form>
      <dbx-content-pit class="dbx-block dbx-mb3" [rounded]="true">
        <dbx-detail-block class="dbx-pb4" icon="link" header="Authorization URL">
          @if (authorizationUrlSignal()) {
            <dbx-click-to-copy-text [copyText]="authorizationUrlSignal()">
              <div class="dbx-small-text" style="word-break: break-all;">{{ authorizationUrlSignal() }}</div>
            </dbx-click-to-copy-text>
          } @else {
            <div class="dbx-hint">Fill in the form above to generate the URL.</div>
          }
        </dbx-detail-block>
        <dbx-detail-block icon="vpn_key" header="Code Verifier (for token exchange)">
          <dbx-click-to-copy-text [copyText]="codeVerifier()">{{ codeVerifier() }}</dbx-click-to-copy-text>
        </dbx-detail-block>
      </dbx-content-pit>
      <div class="dbx-mb3">
        <dbx-button class="dbx-button-spacer" [raised]="true" color="primary" text="Start Authorization Flow" icon="open_in_new" [disabled]="!authorizationUrlSignal()" (buttonClick)="openAuthorizationUrl()"></dbx-button>
        <dbx-button class="dbx-ml2" text="Regenerate PKCE" icon="refresh" (buttonClick)="regeneratePkce()"></dbx-button>
      </div>
    }
  `,
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: CommonModule },
      { kind: 'component', type: DbxFirebaseOidcEntryClientTestForgeFormComponent, selector: 'dbx-firebase-oidc-client-test-forge-form' },
      { kind: 'directive', type: DbxFormSourceDirective, selector: '[dbxFormSource]', inputs: ['dbxFormSourceMode', 'dbxFormSource'] },
      { kind: 'directive', type: DbxFormValueChangeDirective, selector: '[dbxFormValueChange]', outputs: ['dbxFormValueChange'] },
      { kind: 'directive', type: DbxContentPitDirective, selector: 'dbx-content-pit, [dbxContentPit]', inputs: ['scrollable', 'rounded'] },
      { kind: 'component', type: DbxDetailBlockComponent, selector: 'dbx-detail-block', inputs: ['icon', 'header', 'alignHeader', 'bigHeader'] },
      { kind: 'component', type: DbxClickToCopyTextComponent, selector: 'dbx-click-to-copy-text', inputs: ['copyText', 'showIcon', 'highlighted', 'clipboardSnackbarMessagesConfig', 'clipboardSnackbarMessagesEnabled', 'clickToCopyIcon', 'clickIconToCopyOnly'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientTestComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-entry-client-test',
          template: `
    @if (formConfig()) {
      <dbx-firebase-oidc-client-test-forge-form [dbxFormSource]="formTemplate$" dbxFormSourceMode="always" [config]="formConfig()" (dbxFormValueChange)="onFormValueChange($event)"></dbx-firebase-oidc-client-test-forge-form>
      <dbx-content-pit class="dbx-block dbx-mb3" [rounded]="true">
        <dbx-detail-block class="dbx-pb4" icon="link" header="Authorization URL">
          @if (authorizationUrlSignal()) {
            <dbx-click-to-copy-text [copyText]="authorizationUrlSignal()">
              <div class="dbx-small-text" style="word-break: break-all;">{{ authorizationUrlSignal() }}</div>
            </dbx-click-to-copy-text>
          } @else {
            <div class="dbx-hint">Fill in the form above to generate the URL.</div>
          }
        </dbx-detail-block>
        <dbx-detail-block icon="vpn_key" header="Code Verifier (for token exchange)">
          <dbx-click-to-copy-text [copyText]="codeVerifier()">{{ codeVerifier() }}</dbx-click-to-copy-text>
        </dbx-detail-block>
      </dbx-content-pit>
      <div class="dbx-mb3">
        <dbx-button class="dbx-button-spacer" [raised]="true" color="primary" text="Start Authorization Flow" icon="open_in_new" [disabled]="!authorizationUrlSignal()" (buttonClick)="openAuthorizationUrl()"></dbx-button>
        <dbx-button class="dbx-ml2" text="Regenerate PKCE" icon="refresh" (buttonClick)="regeneratePkce()"></dbx-button>
      </div>
    }
  `,
          standalone: true,
          imports: [CommonModule, DbxFirebaseOidcEntryClientTestForgeFormComponent, DbxFormSourceDirective, DbxFormValueChangeDirective, DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxButtonComponent],
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ],
  ctorParameters: () => [],
  propDecorators: { availableScopes: [{ type: i0.Input, args: [{ isSignal: true, alias: 'availableScopes', required: false }] }], oidcAuthorizationEndpointApiPath: [{ type: i0.Input, args: [{ isSignal: true, alias: 'oidcAuthorizationEndpointApiPath', required: false }] }] }
});
function generateRandomString() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Container component for updating an existing OAuth client.
 *
 * Wraps the client update form in an action context with a save button.
 */
class DbxFirebaseOidcEntryClientUpdateComponent {
  oidcEntryDocumentStore = inject(OidcEntryDocumentStore);
  formConfig = { mode: 'update' };
  formTemplate$ = this.oidcEntryDocumentStore.data$.pipe(
    map((data) => {
      const payload = data.payload;
      const formValue = {
        client_name: payload.client_name ?? '',
        redirect_uris: payload.redirect_uris ?? [],
        logo_uri: payload.logo_uri,
        client_uri: payload.client_uri
      };
      return formValue;
    })
  );
  handleUpdateClient = (value, context) => {
    const params = value;
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.updateClient(params));
  };
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientUpdateComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '14.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientUpdateComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-entry-client-update',
    ngImport: i0,
    template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateClient" dbxActionSnackbarError>
      <dbx-firebase-oidc-client-forge-form dbxActionForm [dbxFormSource]="formTemplate$" [config]="formConfig"></dbx-firebase-oidc-client-forge-form>
      <dbx-button [raised]="true" dbxActionButton text="Save"></dbx-button>
    </div>
  `,
    isInline: true,
    dependencies: [
      { kind: 'directive', type: DbxActionSnackbarErrorDirective, selector: '[dbxActionSnackbarError]', inputs: ['dbxActionSnackbarError'] },
      { kind: 'directive', type: DbxActionDirective, selector: 'dbx-action,[dbxAction]', exportAs: ['action', 'dbxAction'] },
      { kind: 'directive', type: DbxActionEnforceModifiedDirective, selector: '[dbxActionEnforceModified]', inputs: ['dbxActionEnforceModified'] },
      { kind: 'directive', type: DbxActionHandlerDirective, selector: '[dbxActionHandler]', inputs: ['dbxActionHandler'] },
      { kind: 'directive', type: DbxActionFormDirective, selector: '[dbxActionForm]', inputs: ['dbxActionFormDisabledOnWorking', 'dbxActionFormIsValid', 'dbxActionFormIsEqual', 'dbxActionFormIsModified', 'dbxActionFormMapValue'] },
      { kind: 'directive', type: DbxFormSourceDirective, selector: '[dbxFormSource]', inputs: ['dbxFormSourceMode', 'dbxFormSource'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] },
      { kind: 'directive', type: DbxActionButtonDirective, selector: '[dbxActionButton]', inputs: ['dbxActionButtonEcho'] },
      { kind: 'component', type: DbxFirebaseOidcEntryClientForgeFormComponent, selector: 'dbx-firebase-oidc-client-forge-form' }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientUpdateComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-entry-client-update',
          template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateClient" dbxActionSnackbarError>
      <dbx-firebase-oidc-client-forge-form dbxActionForm [dbxFormSource]="formTemplate$" [config]="formConfig"></dbx-firebase-oidc-client-forge-form>
      <dbx-button [raised]="true" dbxActionButton text="Save"></dbx-button>
    </div>
  `,
          standalone: true,
          imports: [DbxActionSnackbarErrorDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxFormSourceDirective, DbxButtonComponent, DbxActionButtonDirective, DbxFirebaseOidcEntryClientForgeFormComponent],
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ]
});

/**
 * Displays the OIDC client ID and (when available) the one-time client secret.
 *
 * The client secret is only shown immediately after creation or after rotating.
 * When no secret is available, a "Rotate Secret" button is shown.
 */
class DbxFirebaseOidcEntryClientViewComponent {
  oidcEntryDocumentStore = inject(OidcEntryDocumentStore);
  clientIdSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => data.payload?.client_id)));
  latestClientSecretSignal = toSignal(this.oidcEntryDocumentStore.latestClientSecret$);
  rotateSecretConfirmConfig = {
    title: 'Rotate Client Secret',
    prompt: 'This will invalidate the current client secret. Any applications using it will stop working. Are you sure?',
    confirmText: 'Rotate Secret'
  };
  handleRotateClientSecret = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.rotateClientSecret({}));
  };
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: DbxFirebaseOidcEntryClientViewComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: '17.0.0',
    version: '21.2.11',
    type: DbxFirebaseOidcEntryClientViewComponent,
    isStandalone: true,
    selector: 'dbx-firebase-oidc-entry-client-view',
    ngImport: i0,
    template: `
    <dbx-content-pit [rounded]="true">
      <dbx-detail-block class="dbx-pb4" icon="key" header="Client ID">
        <dbx-click-to-copy-text [copyText]="clientIdSignal()">{{ clientIdSignal() }}</dbx-click-to-copy-text>
      </dbx-detail-block>
      <dbx-detail-block icon="lock" header="Client Secret">
        @if (latestClientSecretSignal()) {
          <dbx-click-to-copy-text class="dbx-block dbx-pb2" [copyText]="latestClientSecretSignal()">{{ latestClientSecretSignal() }}</dbx-click-to-copy-text>
          <dbx-click-to-copy-text [copyText]="latestClientSecretSignal()" [showIcon]="false"><div class="dbx-hint dbx-u">This secret is only shown once. Copy it now.</div></dbx-click-to-copy-text>
        } @else {
          <div>
            <div class="dbx-hint dbx-pb3">The client secret was shown once when created. You can invalidate the old one and get a new one.</div>
            <dbx-button dbxAction [dbxActionHandler]="handleRotateClientSecret" [dbxActionConfirm]="rotateSecretConfirmConfig" dbxActionButton text="Rotate Secret" icon="refresh" color="warn" [raised]="true"></dbx-button>
          </div>
        }
      </dbx-detail-block>
    </dbx-content-pit>
  `,
    isInline: true,
    dependencies: [
      { kind: 'ngmodule', type: CommonModule },
      { kind: 'directive', type: DbxContentPitDirective, selector: 'dbx-content-pit, [dbxContentPit]', inputs: ['scrollable', 'rounded'] },
      { kind: 'component', type: DbxDetailBlockComponent, selector: 'dbx-detail-block', inputs: ['icon', 'header', 'alignHeader', 'bigHeader'] },
      { kind: 'component', type: DbxClickToCopyTextComponent, selector: 'dbx-click-to-copy-text', inputs: ['copyText', 'showIcon', 'highlighted', 'clipboardSnackbarMessagesConfig', 'clipboardSnackbarMessagesEnabled', 'clickToCopyIcon', 'clickIconToCopyOnly'] },
      { kind: 'component', type: DbxButtonComponent, selector: 'dbx-button', inputs: ['bar', 'type', 'buttonStyle', 'color', 'spinnerColor', 'customButtonColor', 'customTextColor', 'customSpinnerColor', 'basic', 'tonal', 'raised', 'stroked', 'flat', 'iconOnly', 'fab', 'customContent', 'allowClickPropagation', 'mode'] },
      { kind: 'directive', type: DbxActionDirective, selector: 'dbx-action,[dbxAction]', exportAs: ['action', 'dbxAction'] },
      { kind: 'directive', type: DbxActionHandlerDirective, selector: '[dbxActionHandler]', inputs: ['dbxActionHandler'] },
      { kind: 'directive', type: DbxActionButtonDirective, selector: '[dbxActionButton]', inputs: ['dbxActionButtonEcho'] },
      { kind: 'directive', type: DbxActionConfirmDirective, selector: '[dbxActionConfirm]', inputs: ['dbxActionConfirm', 'dbxActionConfirmSkip'] }
    ],
    changeDetection: i0.ChangeDetectionStrategy.OnPush
  });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: DbxFirebaseOidcEntryClientViewComponent,
  decorators: [
    {
      type: Component,
      args: [
        {
          selector: 'dbx-firebase-oidc-entry-client-view',
          template: `
    <dbx-content-pit [rounded]="true">
      <dbx-detail-block class="dbx-pb4" icon="key" header="Client ID">
        <dbx-click-to-copy-text [copyText]="clientIdSignal()">{{ clientIdSignal() }}</dbx-click-to-copy-text>
      </dbx-detail-block>
      <dbx-detail-block icon="lock" header="Client Secret">
        @if (latestClientSecretSignal()) {
          <dbx-click-to-copy-text class="dbx-block dbx-pb2" [copyText]="latestClientSecretSignal()">{{ latestClientSecretSignal() }}</dbx-click-to-copy-text>
          <dbx-click-to-copy-text [copyText]="latestClientSecretSignal()" [showIcon]="false"><div class="dbx-hint dbx-u">This secret is only shown once. Copy it now.</div></dbx-click-to-copy-text>
        } @else {
          <div>
            <div class="dbx-hint dbx-pb3">The client secret was shown once when created. You can invalidate the old one and get a new one.</div>
            <dbx-button dbxAction [dbxActionHandler]="handleRotateClientSecret" [dbxActionConfirm]="rotateSecretConfirmConfig" dbxActionButton text="Rotate Secret" icon="refresh" color="warn" [raised]="true"></dbx-button>
          </div>
        }
      </dbx-detail-block>
    </dbx-content-pit>
  `,
          standalone: true,
          imports: [CommonModule, DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxButtonComponent, DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionConfirmDirective],
          changeDetection: ChangeDetectionStrategy.OnPush
        }
      ]
    }
  ]
});

/**
 * Collection store for querying {@link OidcEntry} documents.
 */
class OidcEntryCollectionStore extends AbstractDbxFirebaseCollectionStore {
  constructor() {
    super({ firestoreCollection: inject(OidcModelFirestoreCollections).oidcEntryCollection });
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryCollectionStore, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
  static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryCollectionStore });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: OidcEntryCollectionStore,
  decorators: [
    {
      type: Injectable
    }
  ],
  ctorParameters: () => []
});

/**
 * Directive providing a {@link OidcEntryCollectionStore} for querying {@link OidcEntry} documents.
 */
class OidcEntryCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective {
  constructor() {
    super(inject(OidcEntryCollectionStore));
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryCollectionStoreDirective, deps: [], target: i0.ɵɵFactoryTarget.Directive });
  static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: '14.0.0', version: '21.2.11', type: OidcEntryCollectionStoreDirective, isStandalone: true, selector: '[dbxOidcEntryCollection]', providers: provideDbxFirebaseCollectionStoreDirective(OidcEntryCollectionStoreDirective, OidcEntryCollectionStore), usesInheritance: true, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: OidcEntryCollectionStoreDirective,
  decorators: [
    {
      type: Directive,
      args: [
        {
          selector: '[dbxOidcEntryCollection]',
          providers: provideDbxFirebaseCollectionStoreDirective(OidcEntryCollectionStoreDirective, OidcEntryCollectionStore),
          standalone: true
        }
      ]
    }
  ],
  ctorParameters: () => []
});

/**
 * Directive providing a {@link OidcEntryDocumentStore} for accessing a single {@link OidcEntry} document.
 */
class OidcEntryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective {
  constructor() {
    super(inject(OidcEntryDocumentStore));
  }
  static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: '12.0.0', version: '21.2.11', ngImport: i0, type: OidcEntryDocumentStoreDirective, deps: [], target: i0.ɵɵFactoryTarget.Directive });
  static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: '14.0.0', version: '21.2.11', type: OidcEntryDocumentStoreDirective, isStandalone: true, selector: '[dbxOidcEntryDocument]', providers: provideDbxFirebaseDocumentStoreDirective(OidcEntryDocumentStoreDirective, OidcEntryDocumentStore), usesInheritance: true, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({
  minVersion: '12.0.0',
  version: '21.2.11',
  ngImport: i0,
  type: OidcEntryDocumentStoreDirective,
  decorators: [
    {
      type: Directive,
      args: [
        {
          selector: '[dbxOidcEntryDocument]',
          providers: provideDbxFirebaseDocumentStoreDirective(OidcEntryDocumentStoreDirective, OidcEntryDocumentStore),
          standalone: true
        }
      ]
    }
  ],
  ctorParameters: () => []
});

/**
 * Provider factory for the {@link OidcModelFirestoreCollections}.
 *
 * @param appCollection - The application's Firestore collection that must implement {@link OidcModelFirestoreCollections}.
 * @returns The validated OidcModelFirestoreCollections instance.
 */
function provideOidcModelFirestoreCollections(appCollection) {
  if (!appCollection.oidcEntryCollection) {
    throw new Error(`OidcModelFirestoreCollections could not be provided using the app's app collection. Set provideOidcModelFirestoreCollections to false in ProvideDbxFirebaseOidcConfig to prevent auto-initialization, or update your app's collection class to implement OidcModelFirestoreCollections.`);
  }
  return appCollection;
}
/**
 * Provides the OIDC-related Angular services and collections for `@dereekb/dbx-firebase/oidc`.
 *
 * When `oauthInteractionRoute` is configured in {@link DbxFirebaseOidcConfig}, an app initializer
 * is registered that adds that route to the {@link DbxAppAuthRouterService} ignored routes set,
 * preventing auth effects from redirecting away during the OIDC interaction flow.
 *
 * @param config - Configuration specifying the app collection class, OIDC settings, and provider options.
 * @returns EnvironmentProviders for the OIDC module.
 */
function provideDbxFirebaseOidc(config) {
  const providers = [{ provide: DbxFirebaseOidcConfig, useValue: config.oidcConfig }, DbxFirebaseOidcConfigService];
  if (config.provideOidcModelFirestoreCollections !== false) {
    providers.push({
      provide: OidcModelFirestoreCollections,
      useFactory: provideOidcModelFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }
  // Register the OAuth interaction route as ignored by auth effects
  if (config.oidcConfig.oauthInteractionRoute) {
    const routeRef = config.oidcConfig.oauthInteractionRoute;
    providers.push(
      provideAppInitializer(() => {
        const authRouterService = inject(DbxAppAuthRouterService);
        authRouterService.addIgnoredRoute(routeRef);
      })
    );
  }
  return makeEnvironmentProviders(providers);
}

// @dereekb/dbx-firebase/oidc

/**
 * Generated bundle index. Do not edit.
 */

export {
  AbstractDbxFirebaseOAuthConsentScopeViewComponent,
  DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH,
  DEFAULT_OIDC_CLIENT_ID_PARAM_KEY,
  DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY,
  DEFAULT_OIDC_CLIENT_URI_PARAM_KEY,
  DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH,
  DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY,
  DEFAULT_OIDC_LOGO_URI_PARAM_KEY,
  DEFAULT_OIDC_SCOPES_PARAM_KEY,
  DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
  DbxFirebaseOAuthConsentScopeDefaultViewComponent,
  DbxFirebaseOAuthConsentScopeListComponent,
  DbxFirebaseOAuthConsentViewComponent,
  DbxFirebaseOAuthLoginComponent,
  DbxFirebaseOAuthLoginViewComponent,
  DbxFirebaseOidcConfig,
  DbxFirebaseOidcConfigService,
  DbxFirebaseOidcEntryClientCreateComponent,
  DbxFirebaseOidcEntryClientForgeFormComponent,
  DbxFirebaseOidcEntryClientListComponent,
  DbxFirebaseOidcEntryClientListViewComponent,
  DbxFirebaseOidcEntryClientListViewItemClientComponent,
  DbxFirebaseOidcEntryClientListViewItemComponent,
  DbxFirebaseOidcEntryClientListViewItemDefaultComponent,
  DbxFirebaseOidcEntryClientTestComponent,
  DbxFirebaseOidcEntryClientTestForgeFormComponent,
  DbxFirebaseOidcEntryClientUpdateComponent,
  DbxFirebaseOidcEntryClientViewComponent,
  DbxFirebaseOidcInteractionService,
  DbxOAuthConsentComponent,
  OidcEntryCollectionStore,
  OidcEntryCollectionStoreDirective,
  OidcEntryDocumentStore,
  OidcEntryDocumentStoreDirective,
  oidcClientHomepageUriForgeField,
  oidcClientJwksUriForgeField,
  oidcClientLogoUriForgeField,
  oidcClientNameForgeField,
  oidcClientRedirectUrisForgeField,
  oidcClientTestClientIdForgeField,
  oidcClientTestRedirectUriForgeField,
  oidcClientTestScopesForgeField,
  oidcClientTokenEndpointAuthMethodForgeField,
  oidcEntryClientForgeFormFields,
  oidcEntryClientTestForgeFormFields,
  oidcEntryClientUpdateForgeFormFields,
  provideDbxFirebaseOidc,
  provideOidcModelFirestoreCollections
};
//# sourceMappingURL=dereekb-dbx-firebase-oidc.mjs.map
