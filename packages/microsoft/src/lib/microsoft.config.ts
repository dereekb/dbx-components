import { type WebsiteUrl } from '@dereekb/util';

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
