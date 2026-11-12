import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import {
  type OidcEntryClientId,
  smallestUserExternalConnectionScopePresetCovering,
  type UserExternalConnectionAccessToken,
  type UserExternalConnectionCapability,
  type UserExternalConnectionProviderType,
  type UserExternalConnectionTokenScopeNotGrantedErrorData,
  USER_EXTERNAL_CONNECTION_TOKEN_API_PATH,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE
} from '@dereekb/firebase';
import { assertEndpointOidcScope, badRequestError, type FirebaseServerAuthData, forbiddenError, oidcScopesFromRequestAuth, unauthenticatedError } from '@dereekb/firebase-server';
import { UserExternalConnectionReader, type UserExternalConnectionReaderProviderInstance } from '../userexternalconnection.reader.service';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from '../userexternalconnection.policy';
import { isUserExternalConnectionCredentialsExpiredError } from '../userexternalconnection.error';
import { UserExternalConnectionOAuthProviderRegistry } from '../oauth/userexternalconnection.oauth.registry';
import { type AbstractUserExternalConnectionOAuthService, normalizeUserExternalConnectionProviderScopes, type UserExternalConnectionOAuthNarrowedAccessToken } from '../oauth/userexternalconnection.oauth.service';
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
   * Optional scopes to narrow the minted token to (the `scopes` query parameter).
   *
   * Can only narrow: each one must sit inside the caller's ceiling and inside what the connection was
   * granted, and the provider must be able to mint a narrowed token. An empty list is refused.
   */
  readonly requestedScopes?: Maybe<readonly UserExternalConnectionCapability[]>;
}

/**
 * Parses the `scopes` query parameter of the token mint.
 *
 * Space- and comma-delimited; a repeated parameter is joined. Absent yields undefined. Present but
 * holding no scope at all is refused rather than treated as absent, since a caller that sent
 * `?scopes=` meant to narrow and would otherwise silently get the full ceiling.
 *
 * @param value - The raw query value.
 * @returns The requested scopes, or undefined when the parameter was absent.
 * @throws {HttpsError} A 400 (`USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR`) when the parameter is present but empty or not a string.
 */
export function userExternalConnectionTokenRequestedScopesFromQuery(value: unknown): Maybe<UserExternalConnectionCapability[]> {
  let result: Maybe<UserExternalConnectionCapability[]>;

  if (value != null) {
    const values = Array.isArray(value) ? value : [value];

    if (!values.every((x) => typeof x === 'string')) {
      throw tokenScopesInvalidError('The "scopes" query parameter must be a space- or comma-delimited string of scopes.');
    }

    result = (values as string[]).flatMap((x) => x.split(/[\s,]+/)).filter((x) => x.length > 0);

    if (result.length === 0) {
      throw tokenScopesInvalidError('The "scopes" query parameter was present but named no scopes.');
    }
  }

  return result;
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

function tokenScopesInvalidError(message: string) {
  return badRequestError({ code: USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE, message });
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
 * ## Narrowing
 *
 * After the gates, the minted token can only be NARROWED, never widened:
 *
 * - The caller's CEILING is the union of the provider scopes its OIDC scopes map to under
 *   {@link UserExternalConnectionTokenApiModuleConfig.providerScopes}. An OIDC caller holding none of the
 *   mapped scopes is refused; a non-OIDC caller gets no ceiling.
 * - Requested `scopes` outside the ceiling are refused (403 `..._SCOPE_FORBIDDEN_ERROR`).
 * - A provider that implements `narrowAccessToken` mints a token for the requested scopes (else the
 *   ceiling), provided the connection was granted all of them (403 `..._SCOPE_NOT_GRANTED_ERROR`,
 *   naming the preset to reconnect with, otherwise). A narrowed token whose reported scopes reach past
 *   that target is refused (403 `..._SCOPE_FORBIDDEN_ERROR`) rather than handed out.
 * - A provider that cannot narrow (Zoho, Microsoft) refuses explicit `scopes` (400
 *   `..._NARROWING_UNSUPPORTED_ERROR`), and under a ceiling is minted only when its whole grant fits
 *   inside it (403 `..._SCOPE_FORBIDDEN_ERROR` otherwise).
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

    const oauthService = this._oauthRegistry.serviceForProviderType(providerType);

    // 1-3. the requested scopes and the caller's ceiling, refusing anything that would widen
    const { requestedScopes, ceiling } = this._mintScopesForCaller({ auth, providerType, oauthService, requestedScopes: input.requestedScopes });

    // 4. the usable stored credentials
    const minimumRemaining = config?.minimumRemaining ?? DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING;
    const providerReader = this._reader.readerForUser({ uid })(providerType);
    const credentials = await providerReader.readUsableUserExternalConnectionCredentials({ minimumRemaining });

    // 5-6. narrow to the target, or check the grant fits the ceiling
    const mintedCredentials = await this._mintedCredentials({ uid, providerType, oauthService, providerReader, credentials, target: requestedScopes ?? ceiling, ceiling });

    // 7. never log the token itself
    const clientSuffix = clientId ? ` (client ${clientId})` : '';
    const narrowedSuffix = mintedCredentials === credentials ? '' : ' (narrowed)';
    this._logger.log(`Minted a "${providerType}" access token for uid ${uid}${clientSuffix} with ${mintedCredentials.scopes?.length ?? 0} scope(s)${narrowedSuffix}.`);

    return userExternalConnectionAccessTokenFromCredentials({ uid, providerType, credentials: mintedCredentials, exportedExtraKeys: oauthService?.exportedCredentialExtraKeys });
  }

  /**
   * Normalizes the requested scopes and resolves the caller's ceiling, refusing a request that would
   * widen the token or that the provider cannot honor.
   *
   * @param input - The request auth, the provider, its mounted OAuth service, and the raw requested scopes.
   * @param input.auth - The calling request's auth data.
   * @param input.providerType - The provider whose token is being minted.
   * @param input.oauthService - The provider's mounted OAuth service, if any.
   * @param input.requestedScopes - The raw requested scopes, if any.
   * @returns The normalized requested scopes and the normalized ceiling, each undefined when absent.
   * @throws {HttpsError} A 400 for an empty request or a provider that cannot narrow, or a 403 for a request above the ceiling.
   */
  private _mintScopesForCaller(input: { readonly auth: FirebaseServerAuthData; readonly providerType: UserExternalConnectionProviderType; readonly oauthService: Maybe<AbstractUserExternalConnectionOAuthService>; readonly requestedScopes: Maybe<readonly UserExternalConnectionCapability[]> }): {
    readonly requestedScopes: Maybe<UserExternalConnectionCapability[]>;
    readonly ceiling: Maybe<UserExternalConnectionCapability[]>;
  } {
    const { auth, providerType, oauthService } = input;
    const requestedScopes = input.requestedScopes == null ? undefined : normalizeUserExternalConnectionProviderScopes(oauthService, input.requestedScopes);

    if (requestedScopes?.length === 0) {
      throw tokenScopesInvalidError('The requested scopes named no scopes.');
    }

    // a non-OIDC caller carries no scopes and so gets no ceiling, matching how the scope requirement skips it
    const ceiling = this._ceilingForCaller({ auth, providerType, oauthService });

    if (requestedScopes != null) {
      const ceilingSet = ceiling == null ? undefined : new Set(ceiling);
      const excessScopes = ceilingSet == null ? [] : requestedScopes.filter((scope) => !ceilingSet.has(scope));

      if (excessScopes.length > 0) {
        throw tokenScopeForbiddenError(`The requested scopes exceed what this client may mint for "${providerType}": ${excessScopes.join(' ')}.`, { providerType, excessScopes });
      }

      if (oauthService?.narrowAccessToken == null) {
        throw badRequestError({ code: USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE, message: `"${providerType}" access tokens cannot be narrowed to requested scopes.`, data: { providerType } });
      }
    }

    return { requestedScopes, ceiling };
  }

  /**
   * Produces the credentials to project out: a narrowed token for a provider that can narrow and has a
   * target, else the stored credentials — checked to fit the ceiling for a provider that cannot narrow.
   *
   * @param input - The caller, the provider, its OAuth service and reader, the stored credentials, the target and the ceiling.
   * @param input.uid - The caller's uid.
   * @param input.providerType - The provider whose token is being minted.
   * @param input.oauthService - The provider's mounted OAuth service, if any.
   * @param input.providerReader - The reader for the caller's connection to the provider.
   * @param input.credentials - The usable stored credentials.
   * @param input.target - The scopes the token should carry: the requested scopes, else the ceiling.
   * @param input.ceiling - The caller's ceiling, if any.
   * @returns The credentials to mint the token from.
   * @throws {HttpsError} A 403 when the connection lacks the target scopes or a non-narrowing grant exceeds the ceiling, or the narrowing hook's error.
   */
  private async _mintedCredentials(input: {
    readonly uid: string;
    readonly providerType: UserExternalConnectionProviderType;
    readonly oauthService: Maybe<AbstractUserExternalConnectionOAuthService>;
    readonly providerReader: UserExternalConnectionReaderProviderInstance;
    readonly credentials: UserExternalConnectionCredentials;
    readonly target: Maybe<UserExternalConnectionCapability[]>;
    readonly ceiling: Maybe<UserExternalConnectionCapability[]>;
  }): Promise<UserExternalConnectionCredentials> {
    const { uid, providerType, oauthService, providerReader, credentials, target, ceiling } = input;
    const grantedScopes = credentials.scopes == null ? undefined : normalizeUserExternalConnectionProviderScopes(oauthService, credentials.scopes);
    let result: UserExternalConnectionCredentials = credentials;

    if (target != null && oauthService?.narrowAccessToken != null) {
      // absent granted scopes count as not granted
      const grantedSet = new Set(grantedScopes);
      const missingScopes = target.filter((scope) => !grantedSet.has(scope));

      if (missingScopes.length > 0) {
        const reconnectPreset = smallestUserExternalConnectionScopePresetCovering({ presets: oauthService.scopePresets, scopes: target });
        const data: UserExternalConnectionTokenScopeNotGrantedErrorData & { readonly providerType: UserExternalConnectionProviderType } = { providerType, missingScopes, reconnectScopePreset: reconnectPreset ? { key: reconnectPreset.key, label: reconnectPreset.label } : undefined };
        const hint = reconnectPreset ? `Reconnect "${providerType}" with '${reconnectPreset.label}'.` : `Reconnect "${providerType}" with access to them.`;

        throw forbiddenError({ status: 403, code: USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE, message: `The "${providerType}" connection was not granted: ${missingScopes.join(' ')}. ${hint}`, data });
      }

      let narrowed: UserExternalConnectionOAuthNarrowedAccessToken;

      try {
        narrowed = await oauthService.narrowAccessToken({ uid, credentials, scopes: target });
      } catch (e) {
        // 6. a refresh token the provider no longer honors means the connection is dead; mark it so the
        // user sees it needs a reconnect, then surface the same error
        if (isUserExternalConnectionCredentialsExpiredError(e)) {
          await providerReader.reportUserExternalConnectionFailure({ error: 'expired' });
        }

        throw e;
      }

      // a provider can accept a scope subset yet answer with every consented scope (Microsoft Entra
      // does); handing that token out would widen the caller past its target, and so its ceiling
      const targetSet = new Set(target);
      const widerScopes = normalizeUserExternalConnectionProviderScopes(oauthService, narrowed.scopes ?? []).filter((scope) => !targetSet.has(scope));

      if (widerScopes.length > 0) {
        throw tokenScopeForbiddenError(`The "${providerType}" provider returned a token wider than the scopes it was asked to narrow to: ${widerScopes.join(' ')}.`, { providerType, excessScopes: widerScopes });
      }

      result = { ...credentials, accessToken: narrowed.accessToken, tokenType: narrowed.tokenType ?? credentials.tokenType, scopes: narrowed.scopes, expiresAt: narrowed.expiresAt };
    } else if (ceiling != null) {
      // a provider that cannot narrow mints its stored token as-is, so the whole grant must fit. An
      // unknown grant cannot be shown to fit
      const ceilingSet = new Set(ceiling);
      const excessScopes = grantedScopes?.filter((scope) => !ceilingSet.has(scope));

      if (excessScopes == null || excessScopes.length > 0) {
        throw tokenScopeForbiddenError(`The "${providerType}" connection's scopes exceed what this client may mint and the provider cannot narrow them.`, { providerType, excessScopes });
      }
    }

    return result;
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
