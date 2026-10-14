import { buildOidcSessionEndpoint, discoverOidcMetadata, fetchSessionInfo, refreshAccessToken } from '../auth/oidc.client';
import { cliHandoffRemintSuggestion } from '../auth/auth-failure.hint';
import { buildCliPaths } from '../config/paths';
import { type CliTokenCacheStore, createCliTokenCacheStore, didRotateRefreshToken, isCliTokenEntryExpired, mergeRefreshedTokenEntry } from '../config/token.cache';
import { type DoctorCheck } from './doctor.command.factory';

/**
 * Name reported by the check {@link createTokenRefreshDoctorCheck} builds.
 */
export const TOKEN_REFRESH_DOCTOR_CHECK_NAME = 'token-refresh-round-trip';

/**
 * Seams for {@link createTokenRefreshDoctorCheck}. Production omits all of them and gets the real
 * OIDC client plus the on-disk token cache; tests substitute fakes so the check's PERSIST step can
 * be asserted without a network or a home directory.
 */
export interface TokenRefreshDoctorCheckOverrides {
  readonly tokenStoreForCli?: (cliName: string) => CliTokenCacheStore;
  readonly discoverOidcMetadata?: typeof discoverOidcMetadata;
  readonly refreshAccessToken?: typeof refreshAccessToken;
  readonly fetchSessionInfo?: typeof fetchSessionInfo;
}

/**
 * Builds the doctor check that proves the cached refresh token still works.
 *
 * The round-trip is a REAL refresh, so on a rotating grant it consumes the cached refresh token and
 * the response must be written back — see `mergeRefreshedTokenEntry`. Discarding it (as this check
 * once did) leaves the cache holding a spent credential: the very next refresh fails
 * `invalid_grant`, and a provider doing replay detection revokes the whole grant. The symptom is
 * maximally confusing because the session dies only AFTER the cached access token lapses, so the
 * damage surfaces well away from the `doctor` run that caused it.
 *
 * A bearer handoff credential has no refresh token to round-trip. A live one is verified directly
 * against `GET /oidc/session` and passes with a warning naming when it lapses; an expired one fails
 * with the re-mint suggestion.
 *
 * @param overrides - Optional test seams; production passes none.
 * @returns The {@link DoctorCheck}.
 * @__NO_SIDE_EFFECTS__
 */
export function createTokenRefreshDoctorCheck(overrides: TokenRefreshDoctorCheckOverrides = {}): DoctorCheck {
  const discoverMetadata = overrides.discoverOidcMetadata ?? discoverOidcMetadata;
  const refresh = overrides.refreshAccessToken ?? refreshAccessToken;
  const loadSessionInfo = overrides.fetchSessionInfo ?? fetchSessionInfo;
  const tokenStoreForCli = overrides.tokenStoreForCli ?? ((cliName: string) => createCliTokenCacheStore({ tokenCachePath: buildCliPaths({ cliName }).tokenCachePath }));

  return async ({ cliName, envName, env }) => {
    let result;

    // `clientSecret` is absent for a public (PKCE) client, so requiring it here would report a
    // correctly-configured env as having incomplete credentials.
    if (!envName || !env?.clientId) {
      result = { name: TOKEN_REFRESH_DOCTOR_CHECK_NAME, ok: false, suggestion: 'Env credentials are incomplete.' };
    } else {
      const tokens = tokenStoreForCli(cliName);
      const entry = await tokens.get(envName);

      if (entry?.refreshToken) {
        try {
          const meta = await discoverMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
          const refreshed = await refresh({
            tokenEndpoint: meta.token_endpoint,
            clientId: env.clientId,
            clientSecret: env.clientSecret,
            refreshToken: entry.refreshToken
          });

          // MUST persist: the round-trip consumed the cached refresh token when the grant rotates.
          // A diagnostic command must never break the thing it is diagnosing.
          await tokens.set(envName, mergeRefreshedTokenEntry({ entry, refreshed }));

          result = { name: TOKEN_REFRESH_DOCTOR_CHECK_NAME, ok: true, detail: { rotated: didRotateRefreshToken({ entry, refreshed }) } };
        } catch (e) {
          // a handoff refresh credential is recovered by re-minting, not by `auth login`
          const suggestion = entry.handoff ? cliHandoffRemintSuggestion({ cliName, envName }) : `Run \`${cliName} auth login --env ${envName}\`.`;
          result = { name: TOKEN_REFRESH_DOCTOR_CHECK_NAME, ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, suggestion };
        }
      } else if (entry?.accessToken) {
        const expiresAt = entry.expiresAt;
        const recovery = entry.handoff ? cliHandoffRemintSuggestion({ cliName, envName }) : `Run \`${cliName} auth login --env ${envName}\`.`;

        if (isCliTokenEntryExpired(entry)) {
          result = { name: TOKEN_REFRESH_DOCTOR_CHECK_NAME, ok: false, detail: { refreshable: false, expired: true, expiresAt }, suggestion: `The credential expired at ${new Date(expiresAt).toISOString()} and cannot be refreshed. ${recovery}` };
        } else {
          try {
            await loadSessionInfo({ sessionEndpoint: buildOidcSessionEndpoint(env.oidcIssuer), accessToken: entry.accessToken });
            result = {
              name: TOKEN_REFRESH_DOCTOR_CHECK_NAME,
              ok: true,
              warning: true,
              detail: { refreshable: false, verified: true, expiresAt },
              suggestion: `Bearer credential verified; it cannot be refreshed and lapses at ${new Date(expiresAt).toISOString()}. ${recovery}`
            };
          } catch (e) {
            result = { name: TOKEN_REFRESH_DOCTOR_CHECK_NAME, ok: false, detail: { refreshable: false, error: e instanceof Error ? e.message : String(e) }, suggestion: recovery };
          }
        }
      } else {
        result = {
          name: TOKEN_REFRESH_DOCTOR_CHECK_NAME,
          ok: false,
          detail: { reason: 'no-refresh-token' },
          suggestion: `No refresh token cached for env "${envName}". Run \`${cliName} auth login --env ${envName}\` — if the env's scopes omit \`offline_access\`, the OIDC provider may not issue one.`
        };
      }
    }

    return result;
  };
}
