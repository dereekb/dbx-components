import { Inject, Injectable } from '@nestjs/common';
import type { default as Provider, Interaction, Configuration } from 'oidc-provider';
import { OidcModuleConfig } from '../oidc.config';
import { JwksService } from './oidc.jwks.service';
import { OidcAccountService } from './oidc.account.service';
import { OidcServerFirestoreCollections } from '../model';
import { createAdapterFactory } from './oidc.adapter.service';
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
   * @returns the lazily-initialized oidc-provider instance
   */
  getProvider(): Promise<Provider> {
    return this._getProvider();
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

    if (!accessToken) {
      return undefined;
    }

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

    return {
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
        created_at: existing.created_at
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
   * @param cookieKeys - the signing keys for oidc-provider session cookies
   * @returns the oidc-provider configuration options
   */
  buildProviderConfiguration(cookieKeys: string[]): Configuration {
    const config = this.config;
    const providerConfig = this.providerConfigService.providerConfig;

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
        registrationManagement: { enabled: this.providerConfigService.oidcRegistrationRouteEnabled }
      },
      ttl: {
        AccessToken: config.tokenLifetimes.accessToken,
        IdToken: config.tokenLifetimes.idToken,
        AuthorizationCode: config.tokenLifetimes.authorizationCode,
        RefreshToken: config.tokenLifetimes.refreshToken,
        Session: 14 * 24 * 60 * 60,
        Grant: 14 * 24 * 60 * 60,
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

        if (accountId && scope) {
          const account = await this.accountService.userContext(accountId).findAccount();

          if (account) {
            const claims = await account.claims('access_token', scope);
            const { sub: _sub, ...extraClaims } = claims;

            // Filter out undefined values — the Firestore adapter cannot serialize them.
            return filterUndefinedValues(extraClaims);
          }
        }

        return {};
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

    if (config.suppressBodyParserWarning) {
      // TODO: Will re-apply to logging in testing. Need to resolve.
      // suppressOidcProviderBodyParserWarning();
    }

    return provider;
  }
}
