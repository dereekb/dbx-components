import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import {
  type OidcEntryClientId,
  type UserExternalConnectionAccessToken,
  type UserExternalConnectionAccessTokenResponse,
  type UserExternalConnectionCapability,
  type UserExternalConnectionProviderData,
  type UserExternalConnectionProviderType,
  USER_EXTERNAL_CONNECTION_TOKEN_API_PATH,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE
} from '@dereekb/firebase';
import { assertEndpointOidcScope, type FirebaseServerAuthData, forbiddenError, oidcScopesFromRequestAuth, unauthenticatedError } from '@dereekb/firebase-server';
import { UserExternalConnectionReader } from '../userexternalconnection.reader.service';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from '../userexternalconnection.policy';
import { UserExternalConnectionOAuthProviderRegistry } from '../oauth/userexternalconnection.oauth.registry';
import { type AbstractUserExternalConnectionOAuthService, normalizeUserExternalConnectionProviderScopes } from '../oauth/userexternalconnection.oauth.service';
import { UserExternalConnectionDataServerActions } from '../data/userexternalconnection.data.action.server';
import {
  DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING,
  DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_REQUIRED_OIDC_SCOPE,
  USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE,
  type UserExternalConnectionTokenAllowedClientIds,
  UserExternalConnectionTokenApiModuleConfig,
  type UserExternalConnectionTokenPredicate
} from './userexternalconnection.token.config';

/**
 * Input for {@link UserExternalConnectionTokenApiService.mintAccessToken}.
 */
export interface UserExternalConnectionTokenMintInput {
  /**
   * The calling request's auth data (`req.auth`).
   */
  readonly auth: Maybe<FirebaseServerAuthData>;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Whether to add the caller's stored connection data for this provider (`?include=data`).
   *
   * Read only AFTER every gate passes, and only when the app wired `UserExternalConnectionDataServerActions`. A data
   * failure never blocks the mint: the token is returned without `data`.
   */
  readonly includeData?: Maybe<boolean>;
}

/**
 * Counts the items of a provider's connection data.
 *
 * @param data - The provider data.
 * @returns The number of items across every data type.
 */
export function countUserExternalConnectionProviderDataItems(data: Maybe<UserExternalConnectionProviderData>): number {
  return Object.values(data ?? {}).reduce((sum, items) => sum + Object.keys(items ?? {}).length, 0);
}

/**
 * Projects stored credentials onto what may leave the server.
 *
 * Only the access token and its metadata: never the refresh token, and only the `extra` keys listed.
 *
 * @param input - The caller's uid, provider, stored credentials and the allowlisted `extra` keys.
 * @returns The access token bundle.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionAccessTokenFromCredentials(input: { readonly uid: string; readonly providerType: UserExternalConnectionProviderType; readonly credentials: UserExternalConnectionCredentials; readonly exportedExtraKeys?: Maybe<readonly string[]> }): UserExternalConnectionAccessToken {
  const { uid, providerType, credentials, exportedExtraKeys } = input;
  const extraEntries = (exportedExtraKeys ?? []).filter((key) => credentials.extra?.[key] != null).map((key) => [key, credentials.extra?.[key]] as const);
  const extra = extraEntries.length > 0 ? Object.fromEntries(extraEntries) : undefined;

  return filterUndefinedValues({
    uid,
    providerType,
    accessToken: credentials.accessToken,
    tokenType: credentials.tokenType ?? undefined,
    scopes: credentials.scopes ?? undefined,
    expiresAt: credentials.expiresAt ?? undefined,
    extra
  }) as UserExternalConnectionAccessToken;
}

/**
 * Reads the OIDC client id an access token was issued to, when the caller is an OIDC client.
 *
 * Read structurally: the OIDC auth data shape belongs to `@dereekb/firebase-server/oidc`, which this
 * package does not depend on.
 *
 * @param auth - The request's auth data.
 * @returns Whether the caller is an OIDC client, and its client id when present.
 */
function oidcCallerFromAuth(auth: FirebaseServerAuthData): { readonly isOidc: boolean; readonly clientId?: Maybe<OidcEntryClientId> } {
  const oidcValidatedToken = (auth as { oidcValidatedToken?: Maybe<{ client_id?: Maybe<OidcEntryClientId> }> }).oidcValidatedToken;
  return { isOidc: oidcValidatedToken != null, clientId: oidcValidatedToken?.client_id };
}

async function isClientIdAllowed(allowedClientIds: UserExternalConnectionTokenAllowedClientIds, clientId: Maybe<OidcEntryClientId>): Promise<boolean> {
  let result = false;

  if (clientId) {
    result = typeof allowedClientIds === 'function' ? await allowedClientIds(clientId) : allowedClientIds.includes(clientId);
  }

  return result;
}

function tokenForbiddenError(message: string) {
  return forbiddenError({ status: 403, code: USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE, message });
}

function tokenScopeForbiddenError(message: string, data?: Maybe<object>) {
  return forbiddenError({ status: 403, code: USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE, message, data });
}

/**
 * Mints a short-lived access token for one of the caller's own external connections, so a client (a
 * provider CLI) can call the provider without its own login — and without ever holding the refresh
 * token or the OAuth client secret, which stay on the server.
 *
 * ## Gates, in order
 *
 * 1. An authenticated caller (401 otherwise).
 * 2. An OIDC caller, unless {@link UserExternalConnectionTokenApiModuleConfig.allowNonOidcCallers}; and,
 *    when {@link UserExternalConnectionTokenApiModuleConfig.allowedClientIds} is set, an allowlisted client.
 * 3. The app's {@link UserExternalConnectionTokenPredicate} — the load-bearing check. Fails closed when absent.
 * 4. The OIDC scope requirement (default `token.external`).
 * 5. The provider's `tokenExport` policy — a provider the app did not opt in is never exported.
 *
 * ## Scope ceilings
 *
 * After the gates, the stored token is minted out unchanged: never narrowed, never widened.
 *
 * - The caller's CEILING is the union of the provider scopes its OIDC scopes map to under
 *   {@link UserExternalConnectionTokenApiModuleConfig.providerScopes}. An OIDC caller holding none of the
 *   mapped scopes is refused before the connection is read. A non-OIDC caller, or a provider absent from
 *   `providerScopes`, gets no ceiling.
 * - Under a ceiling the token goes out only when the connection's whole grant fits inside it, after both
 *   pass through the provider's `normalizeScopes` (403 `..._SCOPE_FORBIDDEN_ERROR` otherwise). An unknown
 *   grant cannot be shown to fit, so it is refused too.
 * - No provider mints a token narrower than its grant (Microsoft Entra issues every consented scope,
 *   whatever a refresh asks for). A caller that needs a smaller token needs a connection made with a smaller
 *   scope preset.
 *
 * The token is ALWAYS read for `auth.uid`: there is no way to ask for another user's connection.
 */
@Injectable()
export class UserExternalConnectionTokenApiService {
  private readonly _logger = new Logger(UserExternalConnectionTokenApiService.name);

  constructor(
    @Inject(UserExternalConnectionReader) private readonly _reader: UserExternalConnectionReader,
    @Inject(UserExternalConnectionOAuthProviderRegistry) private readonly _oauthRegistry: UserExternalConnectionOAuthProviderRegistry,
    @Optional() @Inject(UserExternalConnectionProviderPolicyRegistry) private readonly _policyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>,
    @Optional() @Inject(USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE) private readonly _predicate?: Maybe<UserExternalConnectionTokenPredicate>,
    @Optional() @Inject(UserExternalConnectionTokenApiModuleConfig) private readonly _config?: Maybe<UserExternalConnectionTokenApiModuleConfig>,
    @Optional() @Inject(UserExternalConnectionDataServerActions) private readonly _dataActions?: Maybe<UserExternalConnectionDataServerActions>
  ) {
    if (!_predicate) {
      this._logger.warn(`No ${USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE} provided — ${USER_EXTERNAL_CONNECTION_TOKEN_API_PATH} will reject every caller. Provide one from the token module's dependency module.`);
    }
  }

  /**
   * Mints the caller's access token for a provider after enforcing every gate.
   *
   * @param input - The request auth, the provider, and whether to include the caller's connection data.
   * @returns The access token bundle, with `data` when requested, wired and non-empty.
   * @throws {HttpsError} A 401 without a uid, a 403 when a gate refuses, or the reader's error when the user is not connected or the credentials cannot be renewed.
   */
  async mintAccessToken(input: UserExternalConnectionTokenMintInput): Promise<UserExternalConnectionAccessTokenResponse> {
    const { auth, providerType, includeData } = input;
    const uid = auth?.uid;

    if (!auth || !uid) {
      throw unauthenticatedError({ message: 'Minting an external connection token requires an authenticated caller.' });
    }

    const config = this._config;
    const { isOidc, clientId } = oidcCallerFromAuth(auth);

    if (!isOidc && !config?.allowNonOidcCallers) {
      throw tokenForbiddenError('External connection tokens may only be minted by an OIDC client.');
    }

    if (isOidc && config?.allowedClientIds != null && !(await isClientIdAllowed(config.allowedClientIds, clientId))) {
      throw tokenForbiddenError('This OIDC client may not mint external connection tokens.');
    }

    const policy = userExternalConnectionPolicyForProviderType(this._policyRegistry, providerType);
    const isAllowed = this._predicate ? await this._predicate({ auth, providerType, policy }) : false;

    if (!isAllowed) {
      throw tokenForbiddenError('Not authorized to mint external connection tokens.');
    }

    // an explicit `null` disables scope enforcement; only an ABSENT value falls back to the default
    const configuredScope = config?.requiredScope;

    assertEndpointOidcScope({
      requiredScope: configuredScope === undefined ? DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_REQUIRED_OIDC_SCOPE : configuredScope,
      grantedScopes: oidcScopesFromRequestAuth(auth),
      endpoint: USER_EXTERNAL_CONNECTION_TOKEN_API_PATH
    });

    if (policy.tokenExport !== true) {
      throw forbiddenError({ status: 403, code: USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE, message: `"${providerType}" access tokens may not be minted.`, data: { providerType } });
    }

    const oauthService = this._oauthRegistry.serviceForProviderType(providerType);

    // 1. the caller's ceiling; an OIDC caller holding none of the provider's mapped scopes is refused here
    const ceiling = this._ceilingForCaller({ auth, providerType, oauthService });

    // 2. the usable stored credentials
    const minimumRemaining = config?.minimumRemaining ?? DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING;
    const credentials = await this._reader.readerForUser({ uid })(providerType).readUsableUserExternalConnectionCredentials({ minimumRemaining });

    // 3. under a ceiling, the stored token goes out only when the connection's whole grant fits inside it
    if (ceiling != null) {
      this._assertGrantWithinCeiling({ providerType, oauthService, credentials, ceiling });
    }

    // 4. connection data, only now that every gate has passed; a data problem never blocks the mint
    const data = includeData ? await this._readConnectionData(uid, providerType) : undefined;

    // 5. never log the token itself, nor the data
    const clientSuffix = clientId ? ` (client ${clientId})` : '';
    const dataSuffix = data ? ` with connection data (${countUserExternalConnectionProviderDataItems(data)} item(s))` : '';
    this._logger.log(`Minted a "${providerType}" access token for uid ${uid}${clientSuffix} with ${credentials.scopes?.length ?? 0} scope(s)${dataSuffix}.`);

    const token: UserExternalConnectionAccessTokenResponse = userExternalConnectionAccessTokenFromCredentials({ uid, providerType, credentials, exportedExtraKeys: oauthService?.exportedCredentialExtraKeys });
    return data ? { ...token, data } : token;
  }

  /**
   * Reads the caller's connection data for one provider for the mint response.
   *
   * @param uid - The caller.
   * @param providerType - The provider.
   * @returns The non-empty provider data, or undefined when none, not wired, or unreadable.
   */
  private async _readConnectionData(uid: string, providerType: UserExternalConnectionProviderType): Promise<Maybe<UserExternalConnectionProviderData>> {
    let result: Maybe<UserExternalConnectionProviderData>;

    if (this._dataActions) {
      try {
        const data = await this._dataActions.readUserExternalConnectionProviderData({ uid, providerType });
        result = countUserExternalConnectionProviderDataItems(data) > 0 ? data : undefined;
      } catch (e: unknown) {
        const code = (e as Maybe<{ readonly details?: { readonly code?: string } }>)?.details?.code ?? 'UNKNOWN';
        this._logger.warn(`Could not read connection data for uid ${uid} provider "${providerType}" (${code}).`);
      }
    }

    return result;
  }

  /**
   * Asserts the connection's whole grant fits inside the caller's ceiling, since the mint hands out the
   * stored token unchanged.
   *
   * @param input - The provider, its OAuth service, the stored credentials and the caller's ceiling.
   * @param input.providerType - The provider whose token is being minted.
   * @param input.oauthService - The provider's mounted OAuth service, if any; its `normalizeScopes` is applied to the grant.
   * @param input.credentials - The usable stored credentials.
   * @param input.ceiling - The caller's normalized ceiling.
   * @throws {HttpsError} A 403 (`..._SCOPE_FORBIDDEN_ERROR`) when the grant is unknown, or reaches past the ceiling (naming the excess scopes).
   */
  private _assertGrantWithinCeiling(input: { readonly providerType: UserExternalConnectionProviderType; readonly oauthService: Maybe<AbstractUserExternalConnectionOAuthService>; readonly credentials: UserExternalConnectionCredentials; readonly ceiling: readonly UserExternalConnectionCapability[] }): void {
    const { providerType, oauthService, credentials, ceiling } = input;

    if (credentials.scopes == null) {
      throw tokenScopeForbiddenError(`The "${providerType}" connection's granted scopes are unknown, so they cannot be checked against what this client may mint.`, { providerType });
    }

    const ceilingSet = new Set(ceiling);
    const excessScopes = normalizeUserExternalConnectionProviderScopes(oauthService, credentials.scopes).filter((scope) => !ceilingSet.has(scope));

    if (excessScopes.length > 0) {
      throw tokenScopeForbiddenError(`The "${providerType}" connection was granted scopes this client may not mint: ${excessScopes.join(' ')}. Reconnect it with a smaller scope preset, or mint with a login whose scope ceiling allows them.`, { providerType, excessScopes });
    }
  }

  /**
   * Resolves the caller's scope ceiling for a provider from its OIDC scopes.
   *
   * @param input - The request auth, the provider, and its mounted OAuth service.
   * @param input.auth - The calling request's auth data.
   * @param input.providerType - The provider whose token is being minted.
   * @param input.oauthService - The provider's mounted OAuth service, if any.
   * @returns The normalized ceiling, or undefined when the provider has no `providerScopes` entry or the caller is not an OIDC caller.
   * @throws {HttpsError} A 403 (`..._SCOPE_FORBIDDEN_ERROR`) when an OIDC caller holds none of the provider's mapped scopes.
   */
  private _ceilingForCaller(input: { readonly auth: FirebaseServerAuthData; readonly providerType: UserExternalConnectionProviderType; readonly oauthService: Maybe<AbstractUserExternalConnectionOAuthService> }): Maybe<UserExternalConnectionCapability[]> {
    const { auth, providerType, oauthService } = input;
    const providerScopeConfig = this._config?.providerScopes?.find((x) => x.providerType === providerType);
    const grantedOidcScopes = oidcScopesFromRequestAuth(auth);
    let result: Maybe<UserExternalConnectionCapability[]>;

    if (providerScopeConfig != null && grantedOidcScopes != null) {
      const { oidcScopeCeilings } = providerScopeConfig;
      const heldCeilings = Object.entries(oidcScopeCeilings).filter(([oidcScope]) => grantedOidcScopes.has(oidcScope));

      if (heldCeilings.length === 0) {
        throw tokenScopeForbiddenError(`This client holds none of the scopes that allow minting "${providerType}" access tokens.`, { providerType });
      }

      result = normalizeUserExternalConnectionProviderScopes(
        oauthService,
        heldCeilings.flatMap(([, scopes]) => scopes)
      );
    }

    return result;
  }
}
