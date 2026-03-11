import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
import type { Interaction, InteractionResults, Grant } from 'oidc-provider';
import { OidcModuleConfig } from '../oidc.config';
import { JwksService } from './jwks.service';
import { OidcAccountService } from './account.service';
import { OidcFirestoreCollections } from '../model';
import { createAdapterFactory } from './adapter.service';
import { OidcProviderConfigService } from './oidc.config.service';
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
    @Inject(OidcProviderConfigService) private readonly providerConfigService: OidcProviderConfigService,
    @Inject(JwksService) private readonly jwksService: JwksService,
    @Inject(OidcAccountService) private readonly accountService: OidcAccountService,
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
      const result = await this.jwksService.generateKeyPair();
      signingKey = result.signingKey;
    }

    // The provider needs the private JWK (with `d`) for signing tokens.
    // Derive cookie signing key from the resolved encryption secret.
    const getEncryptionKey = resolveEncryptionKey(config.jwksKeyConverterConfig.encryptionSecret);
    const cookieKey = getEncryptionKey().toString('base64').slice(0, 32);

    const adapterFactory = createAdapterFactory(this.collections);
    const providerConfiguration = this.providerConfigService.buildProviderConfiguration([cookieKey]);

    const { default: ProviderClass } = await import('oidc-provider');

    return new ProviderClass(config.issuer, {
      ...providerConfiguration,
      adapter: adapterFactory,
      findAccount: findAccount as any,
      jwks: { keys: [signingKey] as any[] }
    });
  }
}
