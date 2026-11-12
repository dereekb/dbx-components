import { type Maybe } from '@dereekb/util';

/**
 * A Microsoft Graph delegated permission (scope) name, e.g. `Mail.Read`.
 */
export type MicrosoftGraphScope = string;

/**
 * The resource prefix a fully-qualified Graph scope carries, e.g. `https://graph.microsoft.com/Mail.Read`.
 */
export const MICROSOFT_GRAPH_SCOPE_RESOURCE_PREFIX = 'https://graph.microsoft.com/';

/**
 * The OIDC scopes every authorize request asks for: the identity token claims plus `offline_access`,
 * without which Microsoft returns no refresh token.
 */
export const MICROSOFT_OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

/**
 * The Microsoft Graph delegated scopes this package knows, in their canonical casing.
 *
 * Used to normalise how a caller spelled a scope (`mail.read`, `https://graph.microsoft.com/Mail.Read`)
 * so requested, ceiling and granted scopes compare equal. Not an allow-list: an unknown scope is kept
 * as given (minus the resource prefix).
 *
 * @see https://learn.microsoft.com/en-us/graph/permissions-reference
 */
export const KNOWN_MICROSOFT_GRAPH_SCOPES: readonly MicrosoftGraphScope[] = [
  'User.Read',
  'User.ReadBasic.All',
  'Mail.Read',
  'Mail.ReadBasic',
  'Mail.ReadWrite',
  'Mail.Send',
  'MailboxSettings.Read',
  'MailboxSettings.ReadWrite',
  'Calendars.Read',
  'Calendars.Read.Shared',
  'Calendars.ReadWrite',
  'Calendars.ReadWrite.Shared',
  'Contacts.Read',
  'Contacts.ReadWrite',
  'Files.Read',
  'Files.Read.All',
  'Files.ReadWrite',
  'Files.ReadWrite.All',
  'Sites.Read.All',
  'Sites.ReadWrite.All',
  'Tasks.Read',
  'Tasks.ReadWrite',
  'People.Read'
];

const CANONICAL_SCOPE_BY_LOWERCASE = new Map<string, string>([...KNOWN_MICROSOFT_GRAPH_SCOPES, ...MICROSOFT_OIDC_SCOPES].map((scope) => [scope.toLowerCase(), scope]));

const MICROSOFT_OIDC_SCOPE_SET = new Set<string>(MICROSOFT_OIDC_SCOPES);

/**
 * Returns whether the scope is one of the {@link MICROSOFT_OIDC_SCOPES}.
 *
 * @param scope - A normalised scope.
 * @returns True for `openid`, `profile`, `email` and `offline_access`.
 */
export function isMicrosoftOidcScope(scope: string): boolean {
  return MICROSOFT_OIDC_SCOPE_SET.has(scope);
}

/**
 * Normalises one Graph scope: trims it, strips the `https://graph.microsoft.com/` resource prefix, and
 * maps a known scope to its canonical casing case-insensitively.
 *
 * @param scope - The scope as a caller or the token endpoint spelled it.
 * @returns The normalised scope.
 */
export function normalizeMicrosoftGraphScope(scope: string): MicrosoftGraphScope {
  let value = scope.trim();

  if (value.toLowerCase().startsWith(MICROSOFT_GRAPH_SCOPE_RESOURCE_PREFIX)) {
    value = value.slice(MICROSOFT_GRAPH_SCOPE_RESOURCE_PREFIX.length);
  }

  return CANONICAL_SCOPE_BY_LOWERCASE.get(value.toLowerCase()) ?? value;
}

/**
 * Normalises and dedupes a list of Graph scopes, keeping the first-seen order and dropping empty values.
 *
 * @param scopes - The scopes to normalise.
 * @returns The normalised, deduped scopes.
 */
export function normalizeMicrosoftGraphScopes(scopes: readonly string[]): MicrosoftGraphScope[] {
  const seen = new Set<string>();
  const result: MicrosoftGraphScope[] = [];

  scopes.forEach((scope) => {
    const normalized = normalizeMicrosoftGraphScope(scope);

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  });

  return result;
}

/**
 * Reads the Graph scopes out of a token response's space-delimited `scope` string: normalises each,
 * drops the OIDC scopes, and dedupes.
 *
 * @param scope - The space-delimited scope string, e.g. `https://graph.microsoft.com/Mail.Read openid`.
 * @returns The normalised Graph scopes.
 */
export function microsoftGraphScopesFromScopeString(scope: Maybe<string>): MicrosoftGraphScope[] {
  const parts = scope ? scope.split(/\s+/) : [];
  return normalizeMicrosoftGraphScopes(parts).filter((x) => !isMicrosoftOidcScope(x));
}
