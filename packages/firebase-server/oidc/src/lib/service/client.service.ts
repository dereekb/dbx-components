import { type AbstractOidcClientParams, type CreateOidcClientResult, type OidcEntryClientId } from '@dereekb/firebase';
import type { Adapter, ClientMetadata } from 'oidc-provider';
import { OidcService } from './oidc.service';
import { randomBytes, randomUUID } from 'crypto';

// MARK: Service
/**
 * Service for managing OIDC client registrations through the oidc-provider.
 *
 * Uses `provider.Client` to validate client metadata and `provider.Client.adapter`
 * to persist entries, ensuring all oidc-provider validation and lifecycle hooks run.
 */
export class OidcClientService {
  constructor(private readonly oidcService: OidcService) {}

  /**
   * Creates a new OIDC client through the oidc-provider.
   *
   * Generates a `client_id` and `client_secret`, validates the metadata via `provider.Client`,
   * and persists through the adapter.
   *
   * @param params - Client registration parameters.
   * @returns The generated client ID and secret (plaintext, returned only once).
   */
  async createClient(params: AbstractOidcClientParams): Promise<CreateOidcClientResult> {
    const provider = await this.oidcService.getProvider();
    const clientId = randomUUID();
    const clientSecret = randomBytes(32).toString('hex');

    const metadata: ClientMetadata = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: params.client_name ?? undefined,
      redirect_uris: params.redirect_uris ?? undefined,
      grant_types: params.grant_types ?? ['authorization_code', 'refresh_token'],
      response_types: (params.response_types ?? ['code']) as ClientMetadata['response_types'],
      /**
       * TODO: Support all client_secret_jwt, potentially. oidc-provider supports all three. Add the requested type as part of the setup/create.
       *
       * Differences: https://docs.secureauth.com/iam/oauth-client-secret-authentication#client_secret_post
       */
      token_endpoint_auth_method: 'client_secret_post' // refresh token / access token system
    };

    // Use oidc-provider's Client to validate metadata and persist via the adapter.
    // The constructor and static adapter are not fully typed in @types/oidc-provider.
    const ProviderClient = provider.Client as any;
    const client = new ProviderClient(metadata);

    if (client.sectorIdentifierUri !== undefined) {
      await ProviderClient.validate(metadata);
    }

    const payload = client.metadata();
    const adapter: Adapter = ProviderClient.adapter;
    await adapter.upsert(client.clientId, payload, 0);

    return {
      modelKeys: client.clientId,
      client_id: clientId,
      client_secret: clientSecret
    };
  }

  /**
   * Updates an existing OIDC client through the oidc-provider.
   *
   * Loads the existing client payload via the adapter, merges the updated fields,
   * re-validates through `provider.Client`, and persists.
   *
   * @param clientId - The client's document/adapter entry ID.
   * @param params - The fields to update.
   * @throws When the client is not found.
   */
  async updateClient(clientId: OidcEntryClientId, params: AbstractOidcClientParams): Promise<void> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const adapter: Adapter = ProviderClient.adapter;
    const existing = await adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    const updatedMetadata = { ...existing };

    if (params.client_name !== undefined && params.client_name !== null) {
      updatedMetadata.client_name = params.client_name;
    }

    if (params.redirect_uris !== undefined && params.redirect_uris !== null) {
      updatedMetadata.redirect_uris = params.redirect_uris;
    }

    if (params.grant_types !== undefined && params.grant_types !== null) {
      updatedMetadata.grant_types = params.grant_types;
    }

    if (params.response_types !== undefined && params.response_types !== null) {
      updatedMetadata.response_types = params.response_types as ClientMetadata['response_types'];
    }

    // Re-validate through the provider
    const client = new ProviderClient(updatedMetadata);
    const payload = client.metadata();
    await adapter.upsert(client.clientId, payload, 0);
  }

  /**
   * Deletes an OIDC client through the oidc-provider adapter.
   *
   * @param clientId - The client's document/adapter entry ID.
   * @throws When the client is not found.
   */
  async deleteClient(clientId: OidcEntryClientId): Promise<void> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const adapter: Adapter = ProviderClient.adapter;
    const existing = await adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    await adapter.destroy(clientId);
  }
}
