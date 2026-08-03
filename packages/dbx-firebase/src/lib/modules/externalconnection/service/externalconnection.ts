import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type UserExternalConnectionEntry, type UserExternalConnectionEntryMap, type UserExternalConnectionProviderType, userExternalConnectionEntryIsConnected } from '@dereekb/firebase';
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
 * Context handed to a provider's custom {@link DbxFirebaseExternalConnectionConnectFunction}.
 */
export interface DbxFirebaseExternalConnectionConnectContext {
  readonly providerType: UserExternalConnectionProviderType;
  readonly provider: DbxFirebaseExternalConnectionProvider;
  /**
   * The authorize url the default behavior would have navigated to, when one could be resolved.
   */
  readonly authorizeUrl: Maybe<string>;
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
 * The library default is a bare top-level redirect to the provider's authorize url. An app supplies
 * this when connecting needs more than a redirect — most importantly, when the server must mint a
 * short-lived signed `state` first, because a top-level navigation carries no Firebase ID token and
 * the server otherwise cannot know who is connecting. Do NOT append the ID token as a query param.
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
}

/**
 * Configuration for the external connection registry.
 *
 * Declared as an abstract class so it is its own injection token (the newer style, as
 * `DbxFirebaseOidcConfig`). Unlike login there is no library-supplied default catalog for an
 * `InjectionToken`-with-`useFactory` shape to override, and the registry needs more than a list.
 */
export abstract class DbxFirebaseExternalConnectionsConfig {
  /**
   * The providers the app registers.
   */
  abstract readonly providers: DbxFirebaseExternalConnectionProvider[];
  /**
   * Which providers are enabled. Pass `true` (the default) to enable every registered provider.
   */
  readonly enabledProviders?: Maybe<UserExternalConnectionProviderType[] | true>;
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
