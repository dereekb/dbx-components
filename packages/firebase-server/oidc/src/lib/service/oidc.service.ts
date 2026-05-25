import { Inject, Injectable } from '@nestjs/common';
import { errors as OidcProviderErrors, type default as Provider, type Interaction, type Configuration, type KoaContextWithOIDC } from 'oidc-provider';
import { DEFAULT_MAX_REQUESTED_LOGIN_DURATION_SECONDS, DEFAULT_MIN_REQUESTED_LOGIN_DURATION_SECONDS, OidcModuleConfig } from '../oidc.config';
import { DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA, DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM, parseRequestedSessionTtlSeconds, readRemainingGrantSeconds, readRequestedSessionTtlSeconds, resolveLoginDurationSeconds } from './oidc.session-ttl';
import { JwksService } from './oidc.jwks.service';
import { OidcAccountService } from './oidc.account.service';
import { OidcServerFirestoreCollections } from '../model';
import { GRANTABLE_MODEL_NAMES, createAdapterFactory } from './oidc.adapter.service';
import { OidcEncryptionService } from './oidc.encryption.service';
import { OidcProviderConfigService } from './oidc.config.service';
import { resolveEncryptionKey } from '@dereekb/nestjs';
import { type OAuthInteractionLoginDetails, type OAuthInteractionScopes, type OidcEntryClientId, type OidcEntryOAuthClientPayloadData } from '@dereekb/firebase';
import { cachedGetter, filterUndefinedValues, firstValue, type Maybe, unixDateTimeSecondsNumberForNow, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type OidcAuthData } from './oidc.auth';
import { type DecodedIdToken } from 'firebase-admin/auth';
import { makeUrlSearchParamsString } from '@dereekb/util/fetch';

// MARK: Service
/**
 * Core OIDC service that wraps the oidc-provider instance and exposes
 * typed methods for interaction handling, provider initialization, and JWKS management.
 */
@Injectable()
export class OidcService {
  private readonly _getProvider = cachedGetter(() => this._buildProvider());

  // eslint-disable-next-line @typescript-eslint/max-params -- NestJS DI requires individual constructor parameters
  constructor(
    @Inject(OidcModuleConfig) private readonly config: OidcModuleConfig,
    @Inject(OidcProviderConfigService) private readonly providerConfigService: OidcProviderConfigService,
    @Inject(JwksService) private readonly jwksService: JwksService,
    @Inject(OidcAccountService) private readonly accountService: OidcAccountService,
    @Inject(OidcServerFirestoreCollections) private readonly collections: OidcServerFirestoreCollections,
    @Inject(OidcEncryptionService) private readonly encryptionService: OidcEncryptionService
  ) {}

  /**
   * Returns the oidc-provider instance, initializing it on first access.
   *
   * @returns The lazily-initialized oidc-provider instance.
   */
  getProvider(): Promise<Provider> {
    return this._getProvider();
  }

  // MARK: Login Duration
  /**
   * Resolves the login-duration TTL (seconds) for a Grant being created from a fresh consent submission.
   *
   * The Grant TTL configured on the oidc-provider only fires when oidc-provider's koa middleware drives
   * `grant.save()` (so `AsyncLocalStorage` carries the request context). Our consent flow saves grants
   * from a NestJS controller, so we resolve the TTL up-front and pre-set `grant.expiresIn` before saving.
   *
   * Mirrors the resolution used by the `Grant`/`Session` TTL functions in {@link buildProviderConfiguration}.
   *
   * @param requestedRawTtl - The raw `dbx_session_ttl` value from `interaction.params`, if any.
   * @param clientPayload - The persisted client metadata, used to read the per-client `dbx_max_session_ttl` cap.
   * @returns The resolved Grant TTL in seconds.
   */
  resolveLoginDurationForGrant(requestedRawTtl: unknown, clientPayload: { dbx_max_session_ttl?: number } | undefined): number {
    const config = this.config;
    const serverMaxSeconds = config.maxRequestedLoginDuration ?? DEFAULT_MAX_REQUESTED_LOGIN_DURATION_SECONDS;
    const serverMinSeconds = config.minRequestedLoginDuration ?? DEFAULT_MIN_REQUESTED_LOGIN_DURATION_SECONDS;
    const defaultSeconds = config.defaultRequestedLoginDuration ?? config.tokenLifetimes.grant;

    return resolveLoginDurationSeconds({
      requestedSeconds: parseRequestedSessionTtlSeconds(requestedRawTtl),
      clientMaxSeconds: clientPayload?.dbx_max_session_ttl,
      serverMaxSeconds,
      serverMinSeconds,
      defaultSeconds
    });
  }

  // MARK: Token Verification
  /**
   * Verifies an opaque access token and returns the {@link OidcAuthData}.
   *
   * Uses the provider's `AccessToken` model to look up the token and extract
   * the account ID, scope, and client ID.
   *
   * @param rawToken - The opaque access token string.
   * @returns The auth context, or `undefined` if the token is invalid or expired.
   */
  async verifyAccessToken(rawToken: string): Promise<OidcAuthData | undefined> {
    const provider = await this.getProvider();
    const accessToken = await provider.AccessToken.find(rawToken);
    let result: OidcAuthData | undefined;

    if (accessToken) {
      // Extract account claims baked into the access token at issuance time.
      // These are the claims built by OidcAccountServiceDelegate.buildClaimsForUser()
      // (e.g., `a` for admin, `o` for onboarded) based on the granted scopes.
      // Read the account claims baked into the token at issuance time via extraAccessTokenClaims.
      const accountClaims = (accessToken as any).extra ?? {};

      const token: DecodedIdToken = {
        // Account claims from the token (e.g., admin, onboarded)
        ...accountClaims,
        // Standard JWT claims — sourced from the access token
        aud: firstValue(accessToken.aud),
        iss: this.config.issuer,
        sub: accessToken.accountId,
        iat: accessToken.iat,
        exp: accessToken.exp ?? unixDateTimeSecondsNumberForNow() + accessToken.expiration,
        auth_time: accessToken.iat,
        // Firebase UID (copied from sub)
        uid: accessToken.accountId,
        // OIDC-specific claims carried on the token
        scope: accessToken.scope,
        client_id: accessToken.clientId,
        // Firebase sign-in info — marked as OIDC provider
        firebase: {
          identities: {},
          sign_in_provider: 'dbx_oidc'
        }
      };

      result = {
        uid: accessToken.accountId,
        token,
        rawToken,
        oidcValidatedToken: {
          sub: accessToken.accountId,
          scope: accessToken.scope,
          client_id: accessToken.clientId,
          ...accountClaims
        }
      };
    }

    return result;
  }

  // MARK: Grant Revocation
  /**
   * Revokes a Grant entry and every grantable token entry that references it.
   *
   * Iterates through every grantable model (`AccessToken`, `AuthorizationCode`,
   * `RefreshToken`, `DeviceCode`, `BackchannelAuthenticationRequest`) and calls
   * the adapter's `revokeByGrantId` to delete all matching entries, then
   * deletes the Grant adapter entry itself. After this resolves, any token
   * referencing the grant is gone — `verifyAccessToken` returns `undefined`
   * and a `grant_type=refresh_token` exchange fails with `invalid_grant`.
   *
   * @param grantId - The grant id (and Grant adapter entry id) to revoke.
   * @throws {Error} When the Grant entry does not exist.
   */
  async revokeGrant(grantId: string): Promise<void> {
    const provider = await this.getProvider();
    const ProviderGrant = (provider as any).Grant;
    const existing = await ProviderGrant.adapter.find(grantId);

    if (!existing) {
      throw new Error('Grant not found.');
    }

    await Promise.all(
      GRANTABLE_MODEL_NAMES.map((modelName) => {
        const Model = (provider as any)[modelName];
        return Model?.adapter?.revokeByGrantId?.(grantId);
      })
    );

    await ProviderGrant.adapter.destroy(grantId);
  }

  /**
   * Finds a client payload by ID directly from the adapter store.
   *
   * @param clientId - The client's document/adapter entry ID.
   * @returns The client payload data, or `undefined` if not found.
   */
  async findClientPayload(clientId: OidcEntryClientId): Promise<Maybe<OidcEntryOAuthClientPayloadData>> {
    const provider = await this.getProvider();
    const ProviderClient = provider.Client as any;
    const existing = await ProviderClient.adapter.find(clientId);

    let result: Maybe<OidcEntryOAuthClientPayloadData>;

    if (existing) {
      result = {
        client_id: existing.client_id,
        client_name: existing.client_name,
        redirect_uris: existing.redirect_uris,
        grant_types: existing.grant_types,
        response_types: existing.response_types,
        token_endpoint_auth_method: existing.token_endpoint_auth_method,
        logo_uri: existing.logo_uri,
        client_uri: existing.client_uri,
        created_at: existing.created_at,
        dbx_max_session_ttl: existing.dbx_max_session_ttl
      };
    }

    return result;
  }

  /**
   * Builds the oidc-provider {@link Configuration} options that are spread into
   * `new Provider(issuer, { ...options })`.
   *
   * Does NOT include `adapter`, `findAccount`, or `jwks` — those require async
   * setup and are handled by {@link OidcService}.
   *
   * @param cookieKeys - The signing keys for oidc-provider session cookies.
   * @returns The oidc-provider configuration options.
   */
  buildProviderConfiguration(cookieKeys: string[]): Configuration {
    const config = this.config;
    const providerConfig = this.providerConfigService.providerConfig;
    const serverMaxSeconds = config.maxRequestedLoginDuration ?? DEFAULT_MAX_REQUESTED_LOGIN_DURATION_SECONDS;
    const serverMinSeconds = config.minRequestedLoginDuration ?? DEFAULT_MIN_REQUESTED_LOGIN_DURATION_SECONDS;
    const overrideDefaultSeconds = config.defaultRequestedLoginDuration;

    const resolveDurationFromCtx = (ctx: KoaContextWithOIDC | undefined, client: { dbx_max_session_ttl?: number } | undefined, perModelDefaultSeconds: number) =>
      resolveLoginDurationSeconds({
        requestedSeconds: readRequestedSessionTtlSeconds(ctx),
        clientMaxSeconds: client?.dbx_max_session_ttl,
        serverMaxSeconds,
        serverMinSeconds,
        defaultSeconds: overrideDefaultSeconds ?? perModelDefaultSeconds
      });

    return {
      routes: { ...this.providerConfigService.routes },
      claims: { ...providerConfig.claims },
      responseTypes: [...providerConfig.responseTypes] as Configuration['responseTypes'],
      pkce: {
        required: () => true
      },
      features: {
        devInteractions: { enabled: false },
        registration: { enabled: this.providerConfigService.oidcRegistrationRouteEnabled },
        registrationManagement: { enabled: this.providerConfigService.oidcRegistrationRouteEnabled },
        resourceIndicators: {
          enabled: true,
          // useGrantedResource: return true so the token endpoint will bind tokens to a previously
          // granted resource without requiring the client to re-send the `resource` parameter on each
          // refresh — Claude and other MCP clients send `resource` on `/authorize` but not on
          // `/token` refresh.
          useGrantedResource: () => true,
          getResourceServerInfo: async (_ctx, resourceIndicator) => {
            const info = config.resourceServers?.[resourceIndicator];

            if (!info) {
              throw new OidcProviderErrors.InvalidTarget(`Unrecognized resource indicator: ${resourceIndicator}`);
            }

            return {
              scope: info.scope,
              ...(info.audience === undefined ? {} : { audience: info.audience }),
              ...(info.accessTokenTTL === undefined ? {} : { accessTokenTTL: info.accessTokenTTL }),
              ...(info.accessTokenFormat === undefined ? { accessTokenFormat: 'opaque' as const } : { accessTokenFormat: info.accessTokenFormat })
            };
          }
        }
      },
      extraParams: [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM],
      extraClientMetadata: {
        properties: [DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA],
        validator: (_ctx, key, value) => {
          if (key === DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA && value !== undefined && value !== null) {
            if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
              throw new OidcProviderErrors.InvalidClientMetadata(`${DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA} must be a positive integer (seconds).`);
            }

            if (value > serverMaxSeconds) {
              throw new OidcProviderErrors.InvalidClientMetadata(`${DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA} cannot exceed the server max of ${serverMaxSeconds} seconds.`);
            }
          }
        }
      },
      ttl: {
        AccessToken: config.tokenLifetimes.accessToken,
        IdToken: config.tokenLifetimes.idToken,
        AuthorizationCode: config.tokenLifetimes.authorizationCode,
        RefreshToken: (ctx, _refreshToken, _client) => {
          // The token endpoint's ctx.oidc.params holds the token-request body (code, code_verifier, …),
          // not the original auth params — `dbx_session_ttl` is no longer reachable here. The Grant
          // entity is bound on both initial issuance (authorization_code → token) and rotation
          // (refresh_token → token), and its `exp` already encodes the resolved login duration.
          const remaining = readRemainingGrantSeconds(ctx);
          return Math.min(remaining ?? config.tokenLifetimes.refreshToken, config.tokenLifetimes.refreshToken);
        },
        Session: (ctx, _session) => resolveDurationFromCtx(ctx, undefined, config.tokenLifetimes.session),
        Grant: (ctx, _grant, client) => resolveDurationFromCtx(ctx, client as { dbx_max_session_ttl?: number } | undefined, config.tokenLifetimes.grant),
        Interaction: 60 * 60,
        DeviceCode: 10 * 60
      },
      interactions: {
        url: async (_ctx: unknown, interaction: Interaction) => {
          let baseUrl: WebsiteUrlWithPrefix;

          const client_id = interaction.params.client_id as string;

          let paramsToEncode = {
            uid: interaction.uid,
            client_id
          };

          if (interaction.prompt.name === 'login') {
            baseUrl = this.providerConfigService.appLoginUrl;
          } else {
            baseUrl = this.providerConfigService.appConsentUrl;

            // look up client details and add to the url
            const client = await this.findClientPayload(client_id);

            if (client) {
              const scopes = interaction.params.scope as OAuthInteractionScopes;
              const interactionLoginDetails: OAuthInteractionLoginDetails = {
                client_id,
                client_name: client.client_name,
                client_uri: client.client_uri,
                logo_uri: client.logo_uri,
                scopes
              };

              paramsToEncode = {
                ...paramsToEncode,
                ...interactionLoginDetails
              };
            }
          }

          const paramsString = makeUrlSearchParamsString(paramsToEncode, { useUrlSearchSpaceHandling: true });
          return `${baseUrl}?${paramsString}`;
        }
      },
      cookies: {
        keys: cookieKeys
      },
      ...(config.renderError ? { renderError: config.renderError } : {}),
      // Bake account claims into the access token at issuance time so they're
      // available via `accessToken.extra` during verification without an extra DB call.
      extraTokenClaims: async (_ctx: unknown, token: any) => {
        const accountId = token.accountId;
        const scope = token.scope;
        let result: Record<string, unknown> = {};

        if (accountId && scope) {
          const account = await this.accountService.userContext(accountId).findAccount();

          if (account) {
            const claims = await account.claims('access_token', scope);
            const { sub: _sub, ...extraClaims } = claims;

            // Filter out undefined values — the Firestore adapter cannot serialize them.
            result = filterUndefinedValues(extraClaims);
          }
        }

        return result;
      }
    };
  }

  // MARK: Internal
  private async _buildProvider(): Promise<Provider> {
    const config = this.config;
    const findAccount = (_ctx: unknown, id: string) => this.accountService.userContext(id).findAccount();

    let signingKey = await this.jwksService.getActiveSigningKey();

    if (!signingKey) {
      const result = await this.jwksService.generateKeyPair();
      signingKey = result.signingKey;
    }

    // The provider needs the private JWK (with `d`) for signing tokens.
    // Derive cookie signing key from the resolved encryption secret.
    const getEncryptionKey = resolveEncryptionKey(config.jwksKeyConverterConfig.encryptionSecret);
    const cookieKey = getEncryptionKey().toString('base64').slice(0, 32);

    const adapterFactory = createAdapterFactory(this.collections, this.encryptionService);
    const providerConfiguration = this.buildProviderConfiguration([cookieKey]);

    const { default: ProviderClass } = await import('oidc-provider');

    const provider = new ProviderClass(config.issuer, {
      ...providerConfiguration,
      adapter: adapterFactory,
      findAccount: findAccount as any,
      jwks: { keys: [signingKey] as any[] }
    });

    // Trust upstream X-Forwarded-* headers when running behind a reverse proxy
    // (e.g. Firebase Hosting → Cloud Run). Without this, oidc-provider builds
    // the interaction `returnTo` URL off the Cloud Run host instead of the
    // issuer's canonical host, so cookies set on the issuer host are not sent
    // on resume → "authorization request has expired".
    provider.proxy = config.trustProxy ?? true;

    if (config.suppressBodyParserWarning) {
      // TODO: Will re-apply to logging in testing. Need to resolve.
      // suppressOidcProviderBodyParserWarning();
    }

    return provider;
  }
}
