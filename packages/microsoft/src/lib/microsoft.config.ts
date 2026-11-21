import { type Milliseconds, MS_IN_SECOND, type WebsiteUrl } from '@dereekb/util';

/**
 * A Microsoft Entra ID tenant id — a directory GUID (`72f988bf-…`) or a verified domain
 * (`contoso.onmicrosoft.com`).
 *
 * Never one of the multi-tenant authorities (`common`, `organizations`, `consumers`): this package
 * only supports single-tenant app registrations.
 */
export type MicrosoftEntraTenantId = string;

/**
 * The application (client) id of a Microsoft Entra ID app registration.
 */
export type MicrosoftOAuthClientId = string;

/**
 * A client secret of a Microsoft Entra ID app registration.
 */
export type MicrosoftOAuthClientSecret = string;

/**
 * The Microsoft identity platform login host. Per-tenant OAuth endpoints live beneath it.
 */
export const MICROSOFT_LOGIN_URL: WebsiteUrl = 'https://login.microsoftonline.com';

/**
 * The Microsoft Graph v1.0 API base URL.
 */
export const MICROSOFT_GRAPH_API_URL: WebsiteUrl = 'https://graph.microsoft.com/v1.0';

/**
 * Default timeout for the requests the default Microsoft OAuth fetch sends: the wait for the response headers.
 * Configure it per factory with `timeout`.
 */
export const DEFAULT_MICROSOFT_OAUTH_FETCH_TIMEOUT: Milliseconds = 20 * MS_IN_SECOND;

/**
 * Default timeout for the requests the Microsoft Graph client's fetch sends: the wait for the response headers.
 * Configure it per factory with `timeout`.
 */
export const DEFAULT_MICROSOFT_GRAPH_FETCH_TIMEOUT: Milliseconds = 30 * MS_IN_SECOND;
