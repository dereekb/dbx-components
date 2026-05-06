import * as _angular_core from '@angular/core';
import { OnDestroy, Signal, Type, EnvironmentProviders } from '@angular/core';
import * as _dereekb_util from '@dereekb/util';
import { Maybe, ErrorInput } from '@dereekb/util';
import * as _dereekb_dbx_core from '@dereekb/dbx-core';
import { DbxInjectionComponentConfig, SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import * as _dereekb_firebase from '@dereekb/firebase';
import { OAuthInteractionLoginDetails, OidcScope, OidcInteractionUid, OidcTokenEndpointAuthMethod, OidcRedirectUri, OidcScopeDetails, CreateOidcClientParams, UpdateOidcClientFieldParams, OidcEntry, OidcEntryDocument, OidcModelFunctions, CreateOidcClientResult, RotateOidcClientSecretResult, OidcModelFirestoreCollections, OAuthInteractionLoginResponse, OAuthInteractionConsentResponse } from '@dereekb/firebase';
import * as _dereekb_dbx_form from '@dereekb/dbx-form';
import { AbstractConfigAsyncForgeFormDirective } from '@dereekb/dbx-form';
import * as _ng_forge_dynamic_forms_material from '@ng-forge/dynamic-forms-material';
import { ContainerField, FormConfig, RegisteredFieldTypes } from '@ng-forge/dynamic-forms';
import * as rxjs from 'rxjs';
import { Observable } from 'rxjs';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, DbxValueAsListItem, AbstractDbxValueListViewItemComponent, DbxActionConfirmConfig } from '@dereekb/dbx-web';
import { WorkUsingContext } from '@dereekb/rxjs';
import * as _dereekb_dbx_firebase from '@dereekb/dbx-firebase';
import { AbstractDbxFirebaseDocumentStore, AbstractDbxFirebaseCollectionStore, DbxFirebaseCollectionStoreDirective, DbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';

/**
 * State cases for the OIDC login interaction flow.
 */
type OidcLoginStateCase = 'no_user' | 'user' | 'submitting' | 'error';
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
declare class DbxFirebaseOAuthLoginViewComponent {
  readonly loginStateCase: _angular_core.InputSignal<OidcLoginStateCase>;
  readonly error: _angular_core.InputSignal<Maybe<string | ErrorInput>>;
  readonly resolvedError: _angular_core.Signal<Maybe<ErrorInput>>;
  readonly retryClick: _angular_core.OutputEmitterRef<void>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOAuthLoginViewComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOAuthLoginViewComponent, 'dbx-firebase-oauth-login-view', never, { loginStateCase: { alias: 'loginStateCase'; required: true; isSignal: true }; error: { alias: 'error'; required: false; isSignal: true } }, { retryClick: 'retryClick' }, never, ['*'], true, never>;
}

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
declare class DbxFirebaseOAuthConsentViewComponent {
  readonly details: _angular_core.InputSignal<Maybe<OAuthInteractionLoginDetails<string>>>;
  readonly loading: _angular_core.InputSignal<boolean>;
  readonly error: _angular_core.InputSignal<Maybe<string | ErrorInput>>;
  readonly scopeInjectionConfig: _angular_core.InputSignal<DbxInjectionComponentConfig<unknown>>;
  readonly clientName: _angular_core.Signal<string>;
  readonly clientUri: _angular_core.Signal<Maybe<string>>;
  readonly logoUri: _angular_core.Signal<Maybe<string>>;
  readonly scopes: _angular_core.Signal<string[]>;
  readonly resolvedError: _angular_core.Signal<Maybe<ErrorInput>>;
  readonly approveClick: _angular_core.OutputEmitterRef<void>;
  readonly denyClick: _angular_core.OutputEmitterRef<void>;
  readonly resolvedScopeInjectionConfig: _angular_core.Signal<DbxInjectionComponentConfig<unknown>>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOAuthConsentViewComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOAuthConsentViewComponent, 'dbx-firebase-oauth-consent-view', never, { details: { alias: 'details'; required: false; isSignal: true }; loading: { alias: 'loading'; required: false; isSignal: true }; error: { alias: 'error'; required: false; isSignal: true }; scopeInjectionConfig: { alias: 'scopeInjectionConfig'; required: true; isSignal: true } }, { approveClick: 'approveClick'; denyClick: 'denyClick' }, never, never, true, never>;
}

interface OAuthConsentScope<T extends OidcScope = OidcScope> {
  readonly name: T;
  readonly description: string;
}

/**
 * Data provided to consent scope view components via the `DBX_INJECTION_COMPONENT_DATA` token.
 *
 * Contains the scopes being requested and contextual information about the consent interaction.
 */
interface DbxFirebaseOAuthConsentScopesViewData {
  readonly details?: Maybe<OAuthInteractionLoginDetails>;
  readonly scopes: OidcScope[];
  readonly clientName: string;
}
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
declare abstract class AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  private readonly data;
  readonly details: _angular_core.Signal<Maybe<OAuthInteractionLoginDetails<string>>>;
  readonly scopes: _angular_core.Signal<string[]>;
  readonly clientName: _angular_core.Signal<string>;
  readonly clientUri: _angular_core.Signal<Maybe<string>>;
  readonly logoUri: _angular_core.Signal<Maybe<string>>;
}

/**
 * Standalone presentational component that renders a list of OAuth consent scopes.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes"></dbx-firebase-oauth-consent-scope-list>
 * ```
 */
declare class DbxFirebaseOAuthConsentScopeListComponent {
  readonly scopes: _angular_core.InputSignal<OAuthConsentScope<string>[]>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOAuthConsentScopeListComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOAuthConsentScopeListComponent, 'dbx-firebase-oauth-consent-scope-list', never, { scopes: { alias: 'scopes'; required: false; isSignal: true } }, {}, never, never, true, never>;
}

/**
 * Default consent scope view component that maps scope names to descriptions
 * using the `OidcScopeDetails` from the app-level OIDC configuration.
 *
 * Apps can override this by providing a custom `consentScopeListViewClass`
 * in `DbxFirebaseOidcConfig` or `DbxOAuthConsentComponentConfig`.
 */
declare class DbxFirebaseOAuthConsentScopeDefaultViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  private readonly oidcConfigService;
  readonly mappedScopes: _angular_core.Signal<OAuthConsentScope<string>[]>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOAuthConsentScopeDefaultViewComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOAuthConsentScopeDefaultViewComponent, 'dbx-firebase-oauth-consent-scope-default-view', never, {}, {}, never, never, true, never>;
}

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
declare class DbxFirebaseOAuthLoginComponent implements OnDestroy {
  private readonly dbxRouterService;
  private readonly dbxFirebaseAuthService;
  private readonly interactionService;
  readonly uidParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly interactionUid: Signal<Maybe<OidcInteractionUid>>;
  readonly isLoggedIn: Signal<boolean>;
  readonly submitting: _angular_core.WritableSignal<boolean>;
  readonly errorMessage: _angular_core.WritableSignal<string | null>;
  readonly loginStateCase: Signal<OidcLoginStateCase>;
  constructor();
  ngOnDestroy(): void;
  retry(): void;
  private _submitIdToken;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOAuthLoginComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOAuthLoginComponent, 'dbx-firebase-oauth-login', never, {}, {}, never, ['*'], true, never>;
}

/**
 * Configuration for `DbxOAuthConsentComponent`.
 */
interface DbxOAuthConsentComponentConfig {
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, falls back to the class configured in `DbxFirebaseOidcConfig`,
   * which itself defaults to `DbxFirebaseOAuthConsentScopeDefaultViewComponent`.
   */
  readonly consentScopeListViewClass?: Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>;
}
/**
 * Container component for the OIDC OAuth consent screen.
 *
 * Manages all state: route param reading, consent submission, and error handling.
 * Delegates visual rendering to `DbxFirebaseOAuthConsentViewComponent`.
 *
 * Reads interaction UID and client details from route params (populated by
 * the server redirect), then assembles them into `OAuthInteractionLoginDetails`.
 */
declare class DbxOAuthConsentComponent implements OnDestroy {
  private readonly dbxRouterService;
  private readonly interactionService;
  private readonly oidcConfigService;
  readonly config: _angular_core.InputSignal<Maybe<DbxOAuthConsentComponentConfig>>;
  readonly interactionUidParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly clientIdParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly clientNameParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly clientUriParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly logoUriParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  readonly scopesParamReader: _dereekb_dbx_core.DbxRouteParamReaderInstance<string>;
  private readonly routeUid;
  private readonly routeClientId;
  private readonly routeClientName;
  private readonly routeClientUri;
  private readonly routeLogoUri;
  private readonly routeScopes;
  readonly resolvedInteractionUid: _angular_core.Signal<Maybe<string>>;
  readonly resolvedDetails: _angular_core.Signal<Maybe<OAuthInteractionLoginDetails<string>>>;
  readonly scopeInjectionConfig: _angular_core.Signal<DbxInjectionComponentConfig<unknown>>;
  readonly loading: _angular_core.WritableSignal<boolean>;
  readonly error: _angular_core.WritableSignal<string | null>;
  ngOnDestroy(): void;
  approve(): void;
  deny(): void;
  private _submitConsent;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxOAuthConsentComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxOAuthConsentComponent, 'dbx-firebase-oauth-consent', never, { config: { alias: 'config'; required: false; isSignal: true } }, {}, never, never, true, never>;
}

interface OidcEntryClientFormFieldsConfig {
  /**
   * Mode to show. Defaults to 'create'.
   */
  readonly mode: 'create' | 'update';
  /**
   * Token endpoint auth methods available for selection.
   *
   * Provided by the {@link DbxFirebaseOidcConfigService}.
   */
  readonly tokenEndpointAuthMethods: OidcTokenEndpointAuthMethod[];
}
/**
 * Creates forge fields for the OAuth client create form.
 *
 * Includes `token_endpoint_auth_method` which is immutable after creation.
 *
 * @param config - Optional configuration for field generation, including mode and allowed auth methods.
 * @returns A FormConfig for the client creation form.
 */
declare function oidcEntryClientForgeFormFields(config?: OidcEntryClientFormFieldsConfig): FormConfig;
/**
 * Creates a forge value selection field for choosing the token endpoint authentication method.
 *
 * @param config - Optional configuration to filter the available auth method options.
 * @returns A forge value selection field for the token endpoint auth method selector.
 */
declare function oidcClientTokenEndpointAuthMethodForgeField(config?: OidcEntryClientFormFieldsConfig): _dereekb_dbx_form.DbxForgeField<_dereekb_dbx_form.DbxForgeValueSelectionFieldDef<OidcTokenEndpointAuthMethod>>;
/**
 * Creates forge fields for updating an existing OAuth client.
 *
 * Excludes `token_endpoint_auth_method` (immutable after creation).
 *
 * @returns Array of forge field definitions for the client update form.
 */
declare function oidcEntryClientUpdateForgeFormFields(): RegisteredFieldTypes[];
/**
 * Creates a forge text field for the OAuth client display name.
 *
 * @returns A forge text field for the client name.
 */
declare function oidcClientNameForgeField(): _dereekb_dbx_form.DbxForgeField<_ng_forge_dynamic_forms_material.MatInputField>;
/**
 * Creates a forge searchable chip field for entering redirect URIs.
 *
 * @returns A forge searchable chip field for redirect URIs.
 */
declare function oidcClientRedirectUrisForgeField(): _dereekb_dbx_form.DbxForgeField<_dereekb_dbx_form.DbxForgeSearchableChipFieldDef<string, unknown, _dereekb_util.PrimativeKey>>;
/**
 * Creates a forge container wrapping the JWKS URI field, conditionally hidden
 * when the token endpoint auth method is not `private_key_jwt`. A container
 * (not a group) is used so the `jwks_uri` field stays at the root level of
 * the form value rather than being nested under an extra object.
 *
 * @returns A forge container field with conditional visibility logic.
 */
declare function oidcClientJwksUriForgeField(): ContainerField;
/**
 * Creates a forge text field for the optional client logo URL.
 *
 * @returns A forge text field for the logo URI.
 */
declare function oidcClientLogoUriForgeField(): _dereekb_dbx_form.DbxForgeField<_ng_forge_dynamic_forms_material.MatInputField>;
/**
 * Creates a forge text field for the optional client homepage URL.
 *
 * @returns A forge text field for the homepage URL.
 */
declare function oidcClientHomepageUriForgeField(): _dereekb_dbx_form.DbxForgeField<_ng_forge_dynamic_forms_material.MatInputField>;
interface OidcEntryClientTestFormFieldsConfig {
  readonly redirectUris: OidcRedirectUri[];
  readonly availableScopes: OidcScopeDetails[];
}
/**
 * Assembles the forge form fields for the OAuth test client form.
 *
 * @param config - Configuration providing available redirect URIs and scopes for the test form.
 * @returns A FormConfig for the test client form.
 */
declare function oidcEntryClientTestForgeFormFields(config: OidcEntryClientTestFormFieldsConfig): FormConfig;
/**
 * Creates a read-only forge text field displaying the OAuth client ID.
 *
 * @returns A read-only forge text field for the client ID.
 */
declare function oidcClientTestClientIdForgeField(): _dereekb_dbx_form.DbxForgeField<_ng_forge_dynamic_forms_material.MatInputField>;
/**
 * Creates a forge selection field for choosing one of the client's registered redirect URIs for testing.
 *
 * @param redirectUris - The registered redirect URIs to display as options.
 * @returns A forge selection field for the redirect URI.
 */
declare function oidcClientTestRedirectUriForgeField(redirectUris: OidcRedirectUri[]): _dereekb_dbx_form.DbxForgeField<_dereekb_dbx_form.DbxForgeValueSelectionFieldDef<string>>;
/**
 * Creates a forge pickable chip field for selecting scopes to request during the test flow.
 *
 * @param availableScopes - The available scopes to display as selectable options.
 * @returns A forge pickable chip field for scope selection.
 */
declare function oidcClientTestScopesForgeField(availableScopes: OidcScopeDetails[]): _dereekb_dbx_form.DbxForgeField<_dereekb_dbx_form.DbxForgePickableChipFieldDef<unknown, OidcScopeDetails, _dereekb_util.PrimativeKey>>;

type DbxFirebaseOidcModelClientFormValue = CreateOidcClientParams;
type DbxFirebaseOidcModelClientUpdateFormValue = UpdateOidcClientFieldParams;
/**
 * Config input for {@link DbxFirebaseOidcEntryClientForgeFormComponent}.
 *
 * Omits `tokenEndpointAuthMethods` since the component pulls those from {@link DbxFirebaseOidcConfigService}.
 */
type DbxFirebaseOidcEntryClientFormComponentConfig = Omit<OidcEntryClientFormFieldsConfig, 'tokenEndpointAuthMethods'>;
/**
 * Configurable forge form component for creating or updating an OAuth client.
 *
 * Pass `{ mode: 'create' }` to show all fields including `token_endpoint_auth_method`.
 * Pass `{ mode: 'update' }` to exclude `token_endpoint_auth_method` (immutable after creation).
 *
 * Token endpoint auth methods are pulled from the injected {@link DbxFirebaseOidcConfigService}.
 */
declare class DbxFirebaseOidcEntryClientForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseOidcModelClientFormValue, DbxFirebaseOidcEntryClientFormComponentConfig> {
  private readonly _oidcConfigService;
  readonly formConfig$: Observable<Maybe<FormConfig>>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientForgeFormComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientForgeFormComponent, 'dbx-firebase-oidc-client-forge-form', never, {}, {}, never, never, true, never>;
}

interface DbxFirebaseOidcModelClientTestFormValue {
  client_id: string;
  redirect_uri: string;
  scopes: string[];
}
type DbxFirebaseOidcEntryClientTestFormComponentConfig = OidcEntryClientTestFormFieldsConfig;
/**
 * Forge form component for configuring an OAuth test authorization request.
 *
 * Displays read-only client_id, a redirect URI selector, and scope picker.
 */
declare class DbxFirebaseOidcEntryClientTestForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseOidcModelClientTestFormValue, DbxFirebaseOidcEntryClientTestFormComponentConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientTestForgeFormComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientTestForgeFormComponent, 'dbx-firebase-oidc-client-test-forge-form', never, {}, {}, never, never, true, never>;
}

type OidcEntryWithSelection = DbxValueAsListItem<OidcEntry>;
declare class DbxFirebaseOidcEntryClientListComponent extends AbstractDbxSelectionListWrapperDirective<OidcEntry> {
  constructor();
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientListComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientListComponent, 'dbx-firebase-oidc-client-list', never, {}, {}, never, ['[top]', '[bottom]', '[empty]', '[emptyLoading]', '[end]'], true, never>;
}
declare class DbxFirebaseOidcEntryClientListViewComponent extends AbstractDbxSelectionListViewDirective<OidcEntry> {
  readonly config: DbxSelectionValueListViewConfig<OidcEntryWithSelection>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientListViewComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientListViewComponent, 'dbx-firebase-oidc-client-list-view', never, {}, {}, never, never, true, never>;
}
declare class DbxFirebaseOidcEntryClientListViewItemClientComponent {
  readonly entry: _angular_core.InputSignal<OidcEntry>;
  get name(): string;
  get clientId(): string;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientListViewItemClientComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientListViewItemClientComponent, 'dbx-firebase-oidc-client-list-view-item-client', never, { entry: { alias: 'entry'; required: true; isSignal: true } }, {}, never, never, true, never>;
}
declare class DbxFirebaseOidcEntryClientListViewItemDefaultComponent {
  readonly entry: _angular_core.InputSignal<OidcEntry>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientListViewItemDefaultComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientListViewItemDefaultComponent, 'dbx-firebase-oidc-client-list-view-item-default', never, { entry: { alias: 'entry'; required: true; isSignal: true } }, {}, never, never, true, never>;
}
declare class DbxFirebaseOidcEntryClientListViewItemComponent extends AbstractDbxValueListViewItemComponent<OidcEntry> {
  readonly clientType: _dereekb_firebase.OidcEntryType;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientListViewItemComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientListViewItemComponent, 'ng-component', never, {}, {}, never, never, true, never>;
}

/**
 * Document store for a single {@link OidcEntry}.
 */
declare class OidcEntryDocumentStore extends AbstractDbxFirebaseDocumentStore<OidcEntry, OidcEntryDocument> {
  readonly oidcModelFunctions: OidcModelFunctions;
  private readonly _latestClientSecret$;
  /**
   * The client secret from the most recent create operation.
   *
   * Only available immediately after creation — the server does not return it again.
   */
  readonly latestClientSecret$: rxjs.Observable<Maybe<string>>;
  get latestClientSecret(): Maybe<string>;
  constructor();
  readonly createClient: _dereekb_dbx_firebase.DbxFirebaseDocumentStoreCreateFunction<_dereekb_firebase.CreateOidcClientParams, CreateOidcClientResult>;
  readonly updateClient: _dereekb_dbx_firebase.DbxFirebaseDocumentStoreFunction<_dereekb_firebase.UpdateOidcClientParams, void>;
  readonly rotateClientSecret: _dereekb_dbx_firebase.DbxFirebaseDocumentStoreFunction<_dereekb_firebase.TargetModelParams, RotateOidcClientSecretResult>;
  readonly deleteClient: _dereekb_dbx_firebase.DbxFirebaseDocumentStoreFunction<_dereekb_firebase.TargetModelParams, void>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<OidcEntryDocumentStore, never>;
  static ɵprov: _angular_core.ɵɵInjectableDeclaration<OidcEntryDocumentStore>;
}

/**
 * Container component for creating a new OAuth client.
 *
 * Wraps the client form in an action context with a submit button.
 * Emits {@link clientCreated} with the result after successful creation.
 */
declare class DbxFirebaseOidcEntryClientCreateComponent {
  readonly oidcEntryDocumentStore: OidcEntryDocumentStore;
  readonly formConfig: DbxFirebaseOidcEntryClientFormComponentConfig;
  readonly createClientOwnerTarget: _angular_core.InputSignal<Maybe<string>>;
  readonly clientCreated: _angular_core.OutputEmitterRef<CreateOidcClientResult>;
  readonly handleCreateClient: WorkUsingContext<DbxFirebaseOidcModelClientFormValue>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientCreateComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientCreateComponent, 'dbx-firebase-oidc-entry-client-create', never, { createClientOwnerTarget: { alias: 'createClientOwnerTarget'; required: false; isSignal: true } }, { clientCreated: 'clientCreated' }, never, never, true, never>;
}

/**
 * Container component for testing an OAuth authorization flow against a registered client.
 *
 * Displays a form with the client's ID, redirect URIs, and scopes,
 * then builds an authorization URL with PKCE parameters that can be opened in a new tab.
 */
declare class DbxFirebaseOidcEntryClientTestComponent {
  private readonly oidcEntryDocumentStore;
  private readonly oidcConfigService;
  /**
   * Scopes the user can pick from. Overrides the service default when provided.
   */
  readonly availableScopes: _angular_core.InputSignal<Maybe<OidcScopeDetails[]>>;
  /**
   * Path to the authorization endpoint. Overrides the service default when provided.
   */
  readonly oidcAuthorizationEndpointApiPath: _angular_core.InputSignal<Maybe<string>>;
  readonly resolvedAvailableScopes: _angular_core.Signal<OidcScopeDetails[]>;
  readonly resolvedAuthorizationEndpointPath: _angular_core.Signal<string>;
  readonly redirectUrisSignal: _angular_core.Signal<string[] | undefined>;
  readonly clientIdSignal: _angular_core.Signal<string | undefined>;
  readonly formConfig: _angular_core.Signal<OidcEntryClientTestFormFieldsConfig | undefined>;
  readonly formTemplate$: rxjs.Observable<DbxFirebaseOidcModelClientTestFormValue>;
  readonly codeVerifier: _angular_core.WritableSignal<string>;
  readonly codeChallenge: _angular_core.WritableSignal<string>;
  readonly state: _angular_core.WritableSignal<string>;
  readonly nonce: _angular_core.WritableSignal<string>;
  /**
   * The current form value, updated by the form via dbxFormValueChange.
   */
  readonly formValue: _angular_core.WritableSignal<Maybe<DbxFirebaseOidcModelClientTestFormValue>>;
  readonly authorizationUrlSignal: _angular_core.Signal<string | undefined>;
  constructor();
  onFormValueChange(value: Maybe<DbxFirebaseOidcModelClientTestFormValue>): void;
  openAuthorizationUrl(): void;
  regeneratePkce(): void;
  private _updateCodeChallenge;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientTestComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientTestComponent, 'dbx-firebase-oidc-entry-client-test', never, { availableScopes: { alias: 'availableScopes'; required: false; isSignal: true }; oidcAuthorizationEndpointApiPath: { alias: 'oidcAuthorizationEndpointApiPath'; required: false; isSignal: true } }, {}, never, never, true, never>;
}

/**
 * Container component for updating an existing OAuth client.
 *
 * Wraps the client update form in an action context with a save button.
 */
declare class DbxFirebaseOidcEntryClientUpdateComponent {
  readonly oidcEntryDocumentStore: OidcEntryDocumentStore;
  readonly formConfig: DbxFirebaseOidcEntryClientFormComponentConfig;
  readonly formTemplate$: rxjs.Observable<_dereekb_firebase.UpdateOidcClientFieldParams>;
  readonly handleUpdateClient: WorkUsingContext<DbxFirebaseOidcModelClientUpdateFormValue>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientUpdateComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientUpdateComponent, 'dbx-firebase-oidc-entry-client-update', never, {}, {}, never, never, true, never>;
}

/**
 * Displays the OIDC client ID and (when available) the one-time client secret.
 *
 * The client secret is only shown immediately after creation or after rotating.
 * When no secret is available, a "Rotate Secret" button is shown.
 */
declare class DbxFirebaseOidcEntryClientViewComponent {
  readonly oidcEntryDocumentStore: OidcEntryDocumentStore;
  readonly clientIdSignal: _angular_core.Signal<string | undefined>;
  readonly latestClientSecretSignal: _angular_core.Signal<_dereekb_util.Maybe<string>>;
  readonly rotateSecretConfirmConfig: DbxActionConfirmConfig;
  readonly handleRotateClientSecret: WorkUsingContext;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcEntryClientViewComponent, never>;
  static ɵcmp: _angular_core.ɵɵComponentDeclaration<DbxFirebaseOidcEntryClientViewComponent, 'dbx-firebase-oidc-entry-client-view', never, {}, {}, never, never, true, never>;
}

/**
 * Collection store for querying {@link OidcEntry} documents.
 */
declare class OidcEntryCollectionStore extends AbstractDbxFirebaseCollectionStore<OidcEntry, OidcEntryDocument> {
  constructor();
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<OidcEntryCollectionStore, never>;
  static ɵprov: _angular_core.ɵɵInjectableDeclaration<OidcEntryCollectionStore>;
}

/**
 * Directive providing a {@link OidcEntryCollectionStore} for querying {@link OidcEntry} documents.
 */
declare class OidcEntryCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<OidcEntry, OidcEntryDocument, OidcEntryCollectionStore> {
  constructor();
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<OidcEntryCollectionStoreDirective, never>;
  static ɵdir: _angular_core.ɵɵDirectiveDeclaration<OidcEntryCollectionStoreDirective, '[dbxOidcEntryCollection]', never, {}, {}, never, never, true, never>;
}

/**
 * Directive providing a {@link OidcEntryDocumentStore} for accessing a single {@link OidcEntry} document.
 */
declare class OidcEntryDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<OidcEntry, OidcEntryDocument, OidcEntryDocumentStore> {
  constructor();
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<OidcEntryDocumentStoreDirective, never>;
  static ɵdir: _angular_core.ɵɵDirectiveDeclaration<OidcEntryDocumentStoreDirective, '[dbxOidcEntryDocument]', never, {}, {}, never, never, true, never>;
}

declare const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';
declare const DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH = '/interaction';
declare const DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY = 'uid';
declare const DEFAULT_OIDC_CLIENT_ID_PARAM_KEY = 'client_id';
declare const DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY = 'client_name';
declare const DEFAULT_OIDC_CLIENT_URI_PARAM_KEY = 'client_uri';
declare const DEFAULT_OIDC_LOGO_URI_PARAM_KEY = 'logo_uri';
declare const DEFAULT_OIDC_SCOPES_PARAM_KEY = 'scopes';
declare const DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[];
/**
 * Abstract configuration class used as a DI token for app-level OIDC settings.
 *
 * Apps provide a concrete implementation via `provideDbxFirebaseOidc()`.
 */
declare abstract class DbxFirebaseOidcConfig {
  /**
   * Available scopes for the OIDC provider. Used in scope picker fields.
   */
  abstract readonly availableScopes: OidcScopeDetails[];
  /**
   * Path to the authorization endpoint. Defaults to '/oidc/auth'.
   */
  readonly oidcAuthorizationEndpointApiPath?: Maybe<string>;
  /**
   * Base path for interaction endpoints. Defaults to '/interaction'.
   */
  readonly oidcInteractionEndpointApiPath?: Maybe<string>;
  /**
   * Supported token endpoint authentication methods.
   *
   * Overrides the default methods (`client_secret_post`, `client_secret_basic`).
   * Used by forms and UI components that need to know which auth methods are available.
   */
  readonly tokenEndpointAuthMethods?: Maybe<OidcTokenEndpointAuthMethod[]>;
  /**
   * Frontend route ref for the OAuth interaction pages (login/consent).
   *
   * When provided, this route is registered with {@link DbxAppAuthRouterService} as an
   * ignored route, preventing auth effects from redirecting away during the OIDC flow.
   *
   * Uses hierarchical matching — a parent route ref (e.g., `'app.oauth'`) will cover
   * all child routes (e.g., `'app.oauth.login'`, `'app.oauth.consent'`).
   */
  readonly oauthInteractionRoute?: Maybe<SegueRefOrSegueRefRouterLink>;
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, uses `DbxFirebaseOAuthConsentScopeDefaultViewComponent` which
   * maps scope names to descriptions from `availableScopes`.
   */
  readonly consentScopeListViewClass?: Maybe<Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>>;
}
/**
 * Service that exposes the app-level OIDC configuration.
 *
 * Inject this service in components to access centralized OIDC settings
 * (scopes, endpoint paths, param keys, etc.) without requiring explicit inputs.
 */
declare class DbxFirebaseOidcConfigService {
  private readonly config;
  get availableScopes(): OidcScopeDetails[];
  get oidcAuthorizationEndpointApiPath(): string;
  get oidcInteractionEndpointApiPath(): string;
  get tokenEndpointAuthMethods(): OidcTokenEndpointAuthMethod[];
  get oauthInteractionRoute(): Maybe<SegueRefOrSegueRefRouterLink>;
  get consentScopeListViewClass(): Maybe<Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcConfigService, never>;
  static ɵprov: _angular_core.ɵɵInjectableDeclaration<DbxFirebaseOidcConfigService>;
}

/**
 * Provider factory for the {@link OidcModelFirestoreCollections}.
 *
 * @param appCollection - The application's Firestore collection that must implement {@link OidcModelFirestoreCollections}.
 * @returns The validated OidcModelFirestoreCollections instance.
 */
declare function provideOidcModelFirestoreCollections(appCollection: OidcModelFirestoreCollections): OidcModelFirestoreCollections;
/**
 * Configuration for {@link provideDbxFirebaseOidc}.
 */
interface ProvideDbxFirebaseOidcConfig {
  /**
   * The app collection class that implements {@link OidcModelFirestoreCollections}.
   *
   * Used to resolve the {@link OidcModelFirestoreCollections} provider.
   */
  readonly appCollectionClass: abstract new (...args: any[]) => any;
  /**
   * Whether or not to provide the {@link OidcModelFirestoreCollections}.
   *
   * True by default.
   */
  readonly provideOidcModelFirestoreCollections?: boolean;
  /**
   * App-level OIDC configuration (scopes, endpoint paths).
   *
   * Provided as {@link DbxFirebaseOidcConfig} and consumed by {@link DbxFirebaseOidcConfigService}.
   */
  readonly oidcConfig: DbxFirebaseOidcConfig;
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
declare function provideDbxFirebaseOidc(config: ProvideDbxFirebaseOidcConfig): EnvironmentProviders;

/**
 * Service for communicating with the backend OIDC interaction endpoints.
 *
 * Automatically includes the current user's Firebase Auth ID token
 * with each request for server-side verification.
 *
 * After successful login/consent submission, the server returns a redirect URL.
 * The component is responsible for navigating to it (e.g., via `window.location.href`).
 */
declare class DbxFirebaseOidcInteractionService {
  private readonly http;
  private readonly _authService;
  private readonly _oidcConfig;
  /**
   * Base URL for the interaction API, derived from the OIDC config service.
   *
   * @returns The base URL string for the OIDC interaction endpoint.
   */
  get baseUrl(): string;
  /**
   * Submit login to complete the login interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @param uid - The OIDC interaction UID identifying the current login interaction.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitLogin(uid: OidcInteractionUid): Observable<OAuthInteractionLoginResponse>;
  /**
   * Submit consent decision to complete the consent interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @param uid - The OIDC interaction UID identifying the current consent interaction.
   * @param approved - Whether the user approved or denied the consent request.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitConsent(uid: OidcInteractionUid, approved: boolean): Observable<OAuthInteractionConsentResponse>;
  static ɵfac: _angular_core.ɵɵFactoryDeclaration<DbxFirebaseOidcInteractionService, never>;
  static ɵprov: _angular_core.ɵɵInjectableDeclaration<DbxFirebaseOidcInteractionService>;
}

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
export type { DbxFirebaseOAuthConsentScopesViewData, DbxFirebaseOidcEntryClientFormComponentConfig, DbxFirebaseOidcEntryClientTestFormComponentConfig, DbxFirebaseOidcModelClientFormValue, DbxFirebaseOidcModelClientTestFormValue, DbxFirebaseOidcModelClientUpdateFormValue, DbxOAuthConsentComponentConfig, OAuthConsentScope, OidcEntryClientFormFieldsConfig, OidcEntryClientTestFormFieldsConfig, OidcEntryWithSelection, OidcLoginStateCase, ProvideDbxFirebaseOidcConfig };
