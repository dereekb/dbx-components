import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
import type { Interaction, InteractionResults, Grant } from 'oidc-provider';
import { OidcModuleConfig } from '../oidc.config';
import { JwksService } from './oidc.jwks.service';
import { OidcAccountService } from './oidc.account.service';
import { OidcServerFirestoreCollections } from '../model';
import { createAdapterFactory } from './oidc.adapter.service';
import { OidcEncryptionService } from './oidc.encryption.service';
import { OidcProviderConfigService } from './oidc.config.service';
import { resolveEncryptionKey } from '@dereekb/nestjs';
import { type OidcInteractionUid } from '@dereekb/firebase';
import { cachedGetter, firstValue, unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { type OidcAuthData } from './oidc.auth';
import { DecodedIdToken } from 'firebase-admin/auth';

// MARK: Suppress Body Parser Warning
const OIDC_PROVIDER_BODY_PARSER_WARNING = 'oidc-provider WARNING: already parsed request body detected';

/**
 * Patches `console.warn` to suppress the oidc-provider "already parsed request body" warning.
 *
 * Firebase Cloud Functions (and other platforms) parse request bodies before they reach NestJS,
 * so `req.readable` is always `false` when oidc-provider's selective_body middleware runs.
 * The provider handles this correctly by falling back to `req.body`, but emits a one-time warning.
 *
 * This function intercepts that specific warning and silences it. All other warnings pass through.
 */
function suppressOidcProviderBodyParserWarning(): void {
  const originalWarn = console.warn;

  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(OIDC_PROVIDER_BODY_PARSER_WARNING)) {
      return;
    }

    originalWarn.apply(console, args);
  };
}

// MARK: Service
/**
 * Core OIDC service that wraps the oidc-provider instance and exposes
 * typed methods for interaction handling, provider initialization, and JWKS management.
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger('OidcService');
  private readonly _getProvider = cachedGetter(() => this._buildProvider());

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
   */
  getProvider(): Promise<Provider> {
    return this._getProvider();
  }

  // MARK: Interaction
  /**
   * Loads the interaction details for a given request/response pair.
   *
   * Requires the oidc-provider interaction cookie to be present on the request.
   */
  async getInteractionDetails(req: Request, res: Response): Promise<Interaction> {
    const provider = await this.getProvider();
    return provider.interactionDetails(req, res);
  }

  /**
   * Finds an interaction by its UID directly from the adapter store.
   *
   * Bypasses the cookie-based lookup used by `provider.interactionDetails()`.
   * This is necessary when the interaction cookie is scoped to a different path
   * (e.g., the frontend) and is not sent with backend API requests.
   *
   * @throws {Error} When the interaction is not found or has expired.
   */
  async findInteractionByUid(uid: OidcInteractionUid): Promise<Interaction> {
    const provider = await this.getProvider();
    const interaction = await provider.Interaction.find(uid);

    if (!interaction) {
      throw new Error('Interaction not found');
    }

    return interaction;
  }

  /**
   * Completes an interaction by UID without requiring the interaction cookie.
   *
   * Looks up the interaction directly by UID, applies the result, saves it,
   * and returns the `returnTo` URL for the client to redirect to.
   *
   * @returns The `returnTo` URL that the client should redirect to.
   */
  async finishInteractionByUid(uid: OidcInteractionUid, result: InteractionResults, options?: { mergeWithLastSubmission?: boolean }): Promise<string> {
    const interaction = await this.findInteractionByUid(uid);
    const mergeWithLastSubmission = options?.mergeWithLastSubmission ?? true;

    if (mergeWithLastSubmission && !('error' in result)) {
      interaction.result = { ...interaction.lastSubmission, ...result };
    } else {
      interaction.result = result;
    }

    await interaction.save(interaction.exp - unixDateTimeSecondsNumberForNow());
    return interaction.returnTo;
  }

  /**
   * Finds an existing grant by ID, or creates a new one.
   */
  async findOrCreateGrant(grantId: string | undefined, accountId: string, clientId: string): Promise<Grant> {
    const provider = await this.getProvider();
    let grant: Grant;

    if (grantId) {
      grant = (await provider.Grant.find(grantId))!;
    } else {
      grant = new provider.Grant({ accountId, clientId });
    }

    return grant;
  }

  // MARK: Token Verification
  /**
   * Verifies an opaque access token and returns the {@link OidcAuthData}.
   *
   * Uses the provider's `AccessToken` model to look up the token and extract
   * the account ID, scope, and client ID.
   *
   * @param token - The opaque access token string.
   * @returns The auth context, or `undefined` if the token is invalid or expired.
   */
  async verifyAccessToken(rawToken: string): Promise<OidcAuthData | undefined> {
    const provider = await this.getProvider();
    const accessToken = await provider.AccessToken.find(rawToken);

    if (!accessToken) {
      return undefined;
    }

    const token: DecodedIdToken = {
      // Standard JWT claims — sourced from the access token
      aud: firstValue(accessToken.aud) ?? accessToken.clientId,
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
        client_id: accessToken.clientId
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
    const providerConfiguration = this.providerConfigService.buildProviderConfiguration([cookieKey]);

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
