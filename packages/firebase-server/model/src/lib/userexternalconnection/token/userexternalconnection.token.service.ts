import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import { type OidcEntryClientId, type UserExternalConnectionAccessToken, type UserExternalConnectionProviderType, USER_EXTERNAL_CONNECTION_TOKEN_API_PATH, USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE, USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE } from '@dereekb/firebase';
import { assertEndpointOidcScope, type FirebaseServerAuthData, forbiddenError, oidcScopesFromRequestAuth, unauthenticatedError } from '@dereekb/firebase-server';
import { UserExternalConnectionReader } from '../userexternalconnection.reader.service';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from '../userexternalconnection.policy';
import { UserExternalConnectionOAuthProviderRegistry } from '../oauth/userexternalconnection.oauth.registry';
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
    @Optional() @Inject(UserExternalConnectionTokenApiModuleConfig) private readonly _config?: Maybe<UserExternalConnectionTokenApiModuleConfig>
  ) {
    if (!_predicate) {
      this._logger.warn(`No ${USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE} provided — ${USER_EXTERNAL_CONNECTION_TOKEN_API_PATH} will reject every caller. Provide one from the token module's dependency module.`);
    }
  }

  /**
   * Mints the caller's access token for a provider after enforcing every gate.
   *
   * @param input - The request auth and the provider.
   * @returns The access token bundle.
   * @throws {HttpsError} A 401 without a uid, a 403 when a gate refuses, or the reader's error when the user is not connected or the credentials cannot be renewed.
   */
  async mintAccessToken(input: UserExternalConnectionTokenMintInput): Promise<UserExternalConnectionAccessToken> {
    const { auth, providerType } = input;
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

    const minimumRemaining = config?.minimumRemaining ?? DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING;
    const credentials = await this._reader.readerForUser({ uid })(providerType).readUsableUserExternalConnectionCredentials({ minimumRemaining });
    const exportedExtraKeys = this._oauthRegistry.serviceForProviderType(providerType)?.exportedCredentialExtraKeys;

    // never log the token itself
    this._logger.log(`Minted a "${providerType}" access token for uid ${uid}${clientId ? ` (client ${clientId})` : ''}.`);

    return userExternalConnectionAccessTokenFromCredentials({ uid, providerType, credentials, exportedExtraKeys });
  }
}
