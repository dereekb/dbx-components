/**
 * URL query parameter used to request client-side impersonation ("view as another user").
 *
 * When present on an in-app URL (e.g. `/app/dashboard?imp=<uid>`), the value is the
 * {@link AuthUserIdentifier} of the user to impersonate. It is read by the client-side impersonation
 * trigger (to begin/end impersonation) and by URL-decoding tooling (to resolve `{authUid}` model-key
 * placeholders to the impersonated user). Impersonation is client-side only — it never escalates
 * server-side privileges.
 */
export const IMPERSONATION_URL_QUERY_PARAM = 'imp';
