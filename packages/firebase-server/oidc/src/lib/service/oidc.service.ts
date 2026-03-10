import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
import type { Interaction, InteractionResults, Grant } from 'oidc-provider';
import { OidcModuleConfig } from '../oidc.config';
import { JwksService } from './jwks.service';
import { OIDC_ACCOUNT_SERVICE_TOKEN, type OidcAccountService } from './account.service';
import { OidcFirestoreCollections, createOidcProviderAdapterFactory } from '../model';
import { resolveEncryptionKey } from '@dereekb/firebase-server';
import { cachedGetter } from '@dereekb/util';

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
    @Inject(JwksService) private readonly jwksService: JwksService,
    @Inject(OIDC_ACCOUNT_SERVICE_TOKEN) private readonly accountService: OidcAccountService,
    @Inject(OidcFirestoreCollections) private readonly collections: OidcFirestoreCollections
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
   */
  async getInteractionDetails(req: Request, res: Response): Promise<Interaction> {
    const provider = await this.getProvider();
    return provider.interactionDetails(req, res);
  }

  /**
   * Completes an interaction with the given result.
   */
  async finishInteraction(req: Request, res: Response, result: InteractionResults, options?: { mergeWithLastSubmission?: boolean }): Promise<void> {
    const provider = await this.getProvider();
    return provider.interactionFinished(req, res, result, options);
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

  // MARK: Internal
  private async _buildProvider(): Promise<Provider> {
    this.logger.log('Initializing OIDC provider...');
    const config = this.config;
    const findAccount = (_ctx: unknown, id: string) => this.accountService.userContext(id).findAccount();

    let signingKey = await this.jwksService.getActiveSigningKey();

    if (!signingKey) {
      await this.jwksService.generateKeyPair();
      signingKey = await this.jwksService.getActiveSigningKey();
    }

    const jwks = await this.jwksService.getPublicJwks();

    // Derive cookie signing key from the resolved encryption secret.
    const encryptionKeyBuffer = resolveEncryptionKey(config.jwksKeyConverterConfig.encryptionSecret);
    const cookieKey = encryptionKeyBuffer.toString('base64').slice(0, 32);

    const adapterFactory = createOidcProviderAdapterFactory(this.collections);

    const { default: ProviderClass } = await import('oidc-provider');

    return new ProviderClass(config.issuer, {
      adapter: adapterFactory as any,
      findAccount: findAccount as any,
      jwks: { keys: jwks.keys as any[] },
      features: {
        devInteractions: { enabled: false },
        registration: { enabled: true },
        registrationManagement: { enabled: true }
      },
      pkce: {
        methods: ['S256'],
        required: () => true
      },
      responseTypes: ['code'],
      grantTypes: ['authorization_code', 'refresh_token'],
      ttl: {
        AccessToken: config.tokenLifetimes.accessToken,
        AuthorizationCode: config.tokenLifetimes.authorizationCode,
        RefreshToken: config.tokenLifetimes.refreshToken,
        Session: 14 * 24 * 60 * 60,
        Grant: 14 * 24 * 60 * 60,
        Interaction: 60 * 60,
        DeviceCode: 10 * 60
      },
      interactions: {
        url: (_ctx: any, interaction: any) => {
          if (interaction.prompt.name === 'login') {
            return `${config.loginUrl}?uid=${interaction.uid}`;
          }
          return `${config.consentUrl}?uid=${interaction.uid}`;
        }
      },
      claims: {
        openid: ['sub'],
        profile: ['name', 'picture'],
        email: ['email', 'email_verified']
      },
      cookies: {
        keys: [cookieKey]
      }
    });
  }
}
