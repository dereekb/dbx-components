import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Interaction, InteractionResults, Grant } from 'oidc-provider';
import { type OidcInteractionUid } from '@dereekb/firebase';
import { unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { OidcClientService } from './oidc.client.service';
import { OidcService } from './oidc.service';

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
function _suppressOidcProviderBodyParserWarning(): void {
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
 * Service for handling OIDC interactions.
 */
@Injectable()
export class OidcInteractionService {
  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(OidcClientService) private readonly clientService: OidcClientService
  ) {}

  /**
   * Loads the interaction details for a given request/response pair.
   *
   * Requires the oidc-provider interaction cookie to be present on the request.
   *
   * @param req - the Express request containing the interaction cookie
   * @param res - the Express response
   * @returns the oidc-provider interaction details
   */
  async getInteractionDetails(req: Request, res: Response): Promise<Interaction> {
    const provider = await this.oidcService.getProvider();
    return provider.interactionDetails(req, res);
  }

  /**
   * Finds an interaction by its UID directly from the adapter store.
   *
   * Bypasses the cookie-based lookup used by `provider.interactionDetails()`.
   * This is necessary when the interaction cookie is scoped to a different path
   * (e.g., the frontend) and is not sent with backend API requests.
   *
   * @param uid - the interaction UID to look up
   * @returns the interaction details for the given UID
   * @throws {Error} When the interaction is not found or has expired.
   */
  async findInteractionByUid(uid: OidcInteractionUid): Promise<Interaction> {
    const provider = await this.oidcService.getProvider();
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
   * @param uid - the interaction UID to complete
   * @param result - the interaction results to apply
   * @param options - optional settings for merging with the last submission
   * @param options.mergeWithLastSubmission - whether to merge with the last submission (defaults to true)
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
   *
   * @param grantId - the existing grant ID to look up, or undefined to create a new grant
   * @param accountId - the account ID for creating a new grant
   * @param clientId - the client ID for creating a new grant
   * @returns the found or newly created grant
   */
  async findOrCreateGrant(grantId: string | undefined, accountId: string, clientId: string): Promise<Grant> {
    const provider = await this.oidcService.getProvider();
    let grant: Grant;

    if (grantId) {
      const found = await provider.Grant.find(grantId);

      if (!found) {
        throw new Error(`Grant not found for grantId: ${grantId}`);
      }

      grant = found;
    } else {
      grant = new provider.Grant({ accountId, clientId });
    }

    return grant;
  }
}
