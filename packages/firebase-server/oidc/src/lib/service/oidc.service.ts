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

    const provider = new ProviderClass(config.issuer, {
      ...providerConfiguration,
      adapter: adapterFactory,
      findAccount: findAccount as any,
      jwks: { keys: [signingKey] as any[] }
    });

    if (config.suppressBodyParserWarning) {
      suppressOidcProviderBodyParserWarning();
    }

    return provider;
  }
}
