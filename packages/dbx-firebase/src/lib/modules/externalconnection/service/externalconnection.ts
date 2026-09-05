import { type FirebaseLoginMethodType } from '../../../auth/login/login';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type KnownUserExternalConnectionProviderType, type UserExternalConnectionEntry, type UserExternalConnectionEntryMap, type UserExternalConnectionProviderType, userExternalConnectionEntryIsConnected } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type DbxActionConfirmConfig } from '@dereekb/dbx-web';

/**
 * Assets used to render a third-party connection row.
 *
 * Mapped from `DbxFirebaseAuthLoginProviderAssets`, with two deliberate differences:
 * - `providerName` is REQUIRED. An unnamed connection row is not renderable, which is what forces
 *   the login registry into its `'<linkText not configured>'` placeholders.
 * - The full-bleed brand color fields are dropped. A brand-colored button is a sign-in affordance;
 *   a settings row uses a normal themed button and carries the brand in its logo tile.
 */
export interface DbxFirebaseExternalConnectionProviderAssets {
  /**
   * Display name of the provider (e.g. "Cal.com", "Zoom").
   */
  readonly providerName: string;
  /**
   * URL of the logo to use.
   */
  readonly logoUrl?: Maybe<string>;
  /**
   * Material icon to use in place of the logo.
   */
  readonly icon?: Maybe<string>;
  /**
   * Short description of what connecting this provider enables.
   */
  readonly description?: Maybe<string>;
  /**
   * Text for the connect action. Defaults to "Connect".
   */
  readonly connectText?: Maybe<string>;
  /**
   * Text for the disconnect action. Defaults to "Disconnect".
   */
  readonly disconnectText?: Maybe<string>;
  /**
   * Optional CSS filter to apply to the logo image (e.g. 'brightness(0) invert(1)').
   */
  readonly logoFilter?: Maybe<string>;
}

/**
 * Navigates the browser to the given url. Exists as a seam so tests (and apps that route through
 * their own navigation service) never need to touch `window.location`.
 *
 * Returns a promise that settles on the outcome of the navigation, NOT on the request to navigate
 * having been made: it resolves once the new page is actually opening, and rejects when it never
 * does. Callers must await it — that is what keeps the connect action working until the authorize
 * page is really on its way, instead of reporting success against a page that has not moved.
 */
export type DbxFirebaseExternalConnectionNavigateFunction = (url: string) => PromiseOrValue<void>;

/**
 * The opaque, short-lived `state` a provider's OAuth handoff carries.
 *
 * It is what tells the server who is connecting, since the top-level navigation to the provider
 * carries no Firebase ID token of its own.
 */
export type DbxFirebaseExternalConnectionAuthorizeState = string;

/**
 * Mints a fresh {@link DbxFirebaseExternalConnectionAuthorizeState} for a provider.
 */
export type DbxFirebaseExternalConnectionMintAuthorizeStateFunction = () => Promise<DbxFirebaseExternalConnectionAuthorizeState>;

/**
 * Context handed to a provider's custom {@link DbxFirebaseExternalConnectionConnectFunction}.
 */
export interface DbxFirebaseExternalConnectionConnectContext {
  readonly providerType: UserExternalConnectionProviderType;
  readonly provider: DbxFirebaseExternalConnectionProvider;
  /**
   * The authorize url the default behavior would have navigated to, when one could be resolved.
   *
   * WITHOUT the `state` query parameter — the default behavior appends that itself, from
   * {@link mintAuthorizeState}, so a custom handler that skips the mint never pays for one.
   */
  readonly authorizeUrl: Maybe<string>;
  /**
   * Mints the state the authorize request must carry, via an authenticated call.
   *
   * Only needed by a handler that builds its own authorize request; the default behavior does this on
   * its own. Available regardless of the config's `mintAuthorizeState`, since a handler that asks for
   * a state wants one; it throws only when the app never wired the userExternalConnection callables.
   */
  readonly mintAuthorizeState: DbxFirebaseExternalConnectionMintAuthorizeStateFunction;
  /**
   * Navigates the browser. Use this rather than `window.location` directly, and AWAIT it: it settles
   * on the new page actually opening, which is what holds the connect action in its working state
   * until then.
   */
  readonly navigate: DbxFirebaseExternalConnectionNavigateFunction;
}

/**
 * Starts the connect flow for a provider.
 *
 * The library default already mints the signed `state` and redirects to the authorize url carrying
 * it, which is the whole of what an authorization-code handoff needs. An app supplies this only when
 * the flow itself differs — opening a popup instead of navigating, say. Whatever it does, do NOT
 * append the Firebase ID token to the redirect: the state is what identifies the caller.
 *
 * The returned promise must not resolve before the authorize page is opening, so await the context's
 * `navigate` rather than calling it and returning.
 */
export type DbxFirebaseExternalConnectionConnectFunction = (context: DbxFirebaseExternalConnectionConnectContext) => Promise<void> | void;

/**
 * Registration for one third-party service a user can connect their account to.
 *
 * Mapped from `DbxFirebaseAuthLoginProvider`: `loginMethodType` becomes `providerType` and `assets`
 * carries over. `componentClass` / `registrationComponentClass` / `category` / `allowLinking` /
 * `componentData` are dropped — login needs a component per provider because each calls a different
 * Firebase SDK class, whereas here the only per-provider variation is a URL, which is data.
 */
export interface DbxFirebaseExternalConnectionProvider {
  /**
   * Provider type key. MUST match the string the server writes into the connection entry map.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Assets for rendering this provider's row.
   */
  readonly assets: DbxFirebaseExternalConnectionProviderAssets;
  /**
   * Path appended to the configured authorize origin to start this provider's OAuth flow.
   *
   * Defaults to the config's `authorizePathFactory` result.
   */
  readonly authorizePath?: Maybe<string>;
  /**
   * Overrides the default redirect-based connect behavior.
   */
  readonly connect?: Maybe<DbxFirebaseExternalConnectionConnectFunction>;
  /**
   * Confirmation shown before disconnecting.
   */
  readonly disconnectConfirm?: Maybe<DbxActionConfirmConfig>;
  /**
   * Declares that this provider can also be used to LOG IN, and how its login button renders.
   *
   * Present means the registry derives a `DbxFirebaseAuthLoginProvider` for it, so "Log in with
   * Discord" appears beside Google and email. Absent means connect-only, which is what every provider
   * was before sign-in existed.
   *
   * The server must independently enable sign-in for this provider — a client-side declaration alone
   * gets a redirect straight back to the failure url.
   */
  readonly signIn?: Maybe<DbxFirebaseExternalConnectionSignInConfig>;
}

/**
 * How a provider renders and behaves as a LOGIN button.
 *
 * The brand-color fields {@link DbxFirebaseExternalConnectionProviderAssets} deliberately drops are
 * back here, and for the same reason they were dropped there: a settings row uses a normal themed
 * button, while a sign-in button is a brand affordance. The two surfaces genuinely want different
 * presentation, so they get different asset shapes rather than one compromise.
 */
export interface DbxFirebaseExternalConnectionSignInConfig {
  /**
   * Text on the login button, e.g. "Log in with Discord". Defaults to the provider name.
   */
  readonly loginText?: Maybe<string>;
  /**
   * Material icon shown in place of the logo.
   */
  readonly loginIcon?: Maybe<string>;
  /**
   * Brand background color for the button.
   */
  readonly backgroundColor?: Maybe<string>;
  /**
   * Brand text color for the button.
   */
  readonly textColor?: Maybe<string>;
  /**
   * Path appended to the authorize origin to start the sign-in flow.
   *
   * Defaults to {@link DEFAULT_EXTERNAL_CONNECTION_SIGN_IN_PATH_FACTORY}, mirroring how
   * `authorizePath` defaults.
   */
  readonly signInPath?: Maybe<string>;
  /**
   * The login method type this provider registers under. Defaults to the `providerType`.
   *
   * Legal with no type changes at all: `FirebaseLoginMethodType` is a bare string, so a custom
   * `'discord'` method is as valid as `'google'`.
   */
  readonly loginMethodType?: Maybe<FirebaseLoginMethodType>;
  /**
   * App path the sign-in should return to, sent as `returnPath` and validated server-side against the
   * app's allowlist. A path the server does not allow is dropped, not honored.
   */
  readonly returnPath?: Maybe<string>;
}

/**
 * One provider an app offers, as declared in its configuration.
 *
 * A KNOWN provider type is the whole entry: the library already carries its presentation, so flagging
 * a service on is naming it. Every app that connects to Discord shows the same Discord row, and the
 * asset copy is not what varies between downstream apps — the server's OAuth controller is.
 *
 * Pass a full provider to register a service the library has no defaults for, or
 * {@link dbxFirebaseKnownExternalConnectionProvider} to start from a known one and patch it.
 */
export type DbxFirebaseExternalConnectionProviderEntry = KnownUserExternalConnectionProviderType | DbxFirebaseExternalConnectionProvider;

/**
 * Configuration for the external connection registry.
 *
 * Declared as an abstract class so it is its own injection token (the newer style, as
 * `DbxFirebaseOidcConfig`). Unlike login there is no library-supplied default catalog for an
 * `InjectionToken`-with-`useFactory` shape to override, and the registry needs more than a list.
 */
export abstract class DbxFirebaseExternalConnectionsConfig {
  /**
   * The providers the app registers, as known provider types and/or fully-declared providers.
   */
  abstract readonly providers: DbxFirebaseExternalConnectionProviderEntry[];
  /**
   * Which providers are enabled. Pass `true` (the default) to enable every registered provider.
   */
  readonly enabledProviders?: Maybe<UserExternalConnectionProviderType[] | true>;
  /**
   * Whether the connect flow mints a signed `state` and carries it on the authorize request.
   * Defaults to true.
   *
   * This is what identifies the connecting user to the server, since a top-level navigation carries
   * no Firebase ID token: the app's own authorize endpoint bounces a stateless request straight to
   * the failure url. Turn it off only for an endpoint that mints its own state, and note that doing
   * so means no authenticated call is made before the redirect.
   */
  readonly mintAuthorizeState?: Maybe<boolean>;
  /**
   * Origin the authorize paths are resolved against (e.g. the hosting origin that fronts the API).
   *
   * When undefined the authorize path is used as-is, which is the correct behavior when the app and
   * the OAuth controller share an origin.
   */
  readonly authorizeOrigin?: Maybe<string>;
  /**
   * Builds the default authorize path for a provider that does not declare its own.
   *
   * Defaults to {@link DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY}.
   */
  readonly authorizePathFactory?: Maybe<(providerType: UserExternalConnectionProviderType) => string>;
  /**
   * Navigation seam used by the default connect behavior.
   *
   * Defaults to {@link DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION}. An override owns the same
   * contract: settle only once the new page is actually opening.
   */
  readonly navigate?: Maybe<DbxFirebaseExternalConnectionNavigateFunction>;
}

/**
 * Default authorize path for a provider: `/oauth/<providerType>/authorize`.
 *
 * @param providerType - The provider to build a path for.
 * @returns The authorize path.
 */
export const DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY = (providerType: UserExternalConnectionProviderType) => `/oauth/${providerType}/authorize`;

/**
 * Default sign-in path for a provider: `/oauth/<providerType>/signin`.
 *
 * @param providerType - The provider to build a path for.
 * @returns The sign-in path.
 */
export const DEFAULT_EXTERNAL_CONNECTION_SIGN_IN_PATH_FACTORY = (providerType: UserExternalConnectionProviderType) => `/oauth/${providerType}/signin`;

/**
 * Default ticket-exchange path for a provider: `/oauth/<providerType>/token`.
 *
 * @param providerType - The provider to build a path for.
 * @returns The token path.
 */
export const DEFAULT_EXTERNAL_CONNECTION_TOKEN_PATH_FACTORY = (providerType: UserExternalConnectionProviderType) => `/oauth/${providerType}/token`;

/**
 * Query parameter the completed sign-in returns its ticket on. Must match the server's.
 */
export const EXTERNAL_CONNECTION_SIGN_IN_TICKET_PARAM = 'ticket';

/**
 * `sessionStorage` key the in-flight sign-in's PKCE verifier is held under.
 *
 * `sessionStorage`, not `localStorage`: the verifier is scoped to the tab that started the flow and
 * must not outlive it. It is the single secret proving the returning page is the one that began the
 * sign-in, so a verifier shared across tabs would weaken exactly what it exists to establish.
 */
export const EXTERNAL_CONNECTION_SIGN_IN_VERIFIER_STORAGE_KEY = 'dbx.externalconnection.signin.verifier';

// MARK: Rows
/**
 * Presentation status of a connection row.
 */
export type DbxFirebaseExternalConnectionRowStatus = 'loading' | 'connected' | 'notConnected' | 'error';

/**
 * One provider's row, as rendered on the settings page.
 */
export interface DbxFirebaseExternalConnectionRow {
  readonly providerType: UserExternalConnectionProviderType;
  readonly assets: DbxFirebaseExternalConnectionProviderAssets;
  /**
   * The user's entry for this provider, when there is one.
   */
  readonly entry?: Maybe<UserExternalConnectionEntry>;
  readonly status: DbxFirebaseExternalConnectionRowStatus;
  /**
   * Whether this provider is currently enabled. A disabled provider the user is still connected to
   * is retained as a row so it can be disconnected.
   */
  readonly enabled: boolean;
}

/**
 * An action rendered on a connection row.
 *
 * Rows take an ARRAY of these because the `error` status wants both Reconnect and Disconnect.
 */
export interface DbxFirebaseExternalConnectionActionConfig {
  readonly label: string;
  readonly icon?: Maybe<string>;
  readonly confirm?: Maybe<DbxActionConfirmConfig>;
  readonly handler: WorkUsingContext;
}

/**
 * One rendered list item: a row plus the actions currently available for it.
 *
 * The actions are paired with the row here rather than derived by the item component because building them needs
 * the connect/disconnect handlers, which belong to the container that owns the stores.
 */
export interface DbxFirebaseExternalConnectionListItemValue {
  readonly row: DbxFirebaseExternalConnectionRow;
  readonly actions?: Maybe<DbxFirebaseExternalConnectionActionConfig[]>;
}

/**
 * Derives a row's presentation status from its entry.
 *
 * @param entry - The user's entry for the provider, if any.
 * @returns The row status.
 */
export function dbxFirebaseExternalConnectionRowStatusForEntry(entry: Maybe<UserExternalConnectionEntry>): DbxFirebaseExternalConnectionRowStatus {
  let result: DbxFirebaseExternalConnectionRowStatus;

  if (userExternalConnectionEntryIsConnected(entry)) {
    result = 'connected';
  } else if (entry?.st === 'error') {
    result = 'error';
  } else {
    result = 'notConnected';
  }

  return result;
}

/**
 * Input for {@link dbxFirebaseExternalConnectionRows}.
 */
export interface DbxFirebaseExternalConnectionRowsInput {
  /**
   * Every registered provider, in registration order.
   */
  readonly providers: DbxFirebaseExternalConnectionProvider[];
  /**
   * The provider types that are currently enabled.
   */
  readonly enabledProviderTypes: UserExternalConnectionProviderType[];
  /**
   * The user's per-provider entries, or null while still loading.
   */
  readonly entries: Maybe<UserExternalConnectionEntryMap>;
  /**
   * Whether the connection document is still loading.
   */
  readonly loading?: Maybe<boolean>;
}

/**
 * Builds the rows to render.
 *
 * The row set is the union of the enabled providers and any registered provider the user still has
 * an entry for, so a provider that has since been disabled can still be disconnected.
 *
 * @param input - The registry state plus the user's entries.
 * @returns The rows, in registration order.
 */
export function dbxFirebaseExternalConnectionRows(input: DbxFirebaseExternalConnectionRowsInput): DbxFirebaseExternalConnectionRow[] {
  const { providers, enabledProviderTypes, entries, loading } = input;
  const enabled = new Set(enabledProviderTypes);

  return providers
    .filter((x) => enabled.has(x.providerType) || entries?.[x.providerType] != null)
    .map((provider) => {
      const entry = entries?.[provider.providerType];

      return {
        providerType: provider.providerType,
        assets: provider.assets,
        entry,
        status: loading ? ('loading' as const) : dbxFirebaseExternalConnectionRowStatusForEntry(entry),
        enabled: enabled.has(provider.providerType)
      };
    });
}
