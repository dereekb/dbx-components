import { type Maybe } from '@dereekb/util';
import type { Adapter, ClientMetadata } from 'oidc-provider';
import { OidcService } from './oidc.service';
import { randomBytes, randomUUID } from 'crypto';

// MARK: Types
/**
 * Result of creating a new OIDC client via the {@link OidcClientService}.
 */
export interface OidcClientServiceCreateResult {
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * Fields that can be provided when creating or updating an OIDC client.
 */
export interface OidcClientServiceUpdateParams {
  readonly client_name?: Maybe<string>;
  readonly redirect_uris?: Maybe<string[]>;
  readonly grant_types?: Maybe<string[]>;
  readonly response_types?: Maybe<string[]>;
}

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
   * @param uid - The owning user's Firebase Auth UID.
   * @param params - Client registration parameters.
   * @returns The generated client ID and secret (plaintext, returned only once).
   */
  async createClient(uid: string, params: OidcClientServiceUpdateParams): Promise<OidcClientServiceCreateResult> {
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
      token_endpoint_auth_method: 'client_secret_post', // TODO: Need to verify this is the correct auth endpoint...
      uid
    };

    // Use oidc-provider's Client to validate metadata and persist via the adapter.
    // The constructor and static adapter are not fully typed in @types/oidc-provider.
    const ProviderClient = provider.Client as any;
    const client = new ProviderClient(metadata);

    if (client.sectorIdentifierUri !== undefined) {
      await ProviderClient.validate(metadata);
    }

    const payload = client.metadata();
    payload.uid = uid;

    const adapter: Adapter = ProviderClient.adapter;
    await adapter.upsert(client.clientId, payload, 0);

    return {
      clientId,
      clientSecret
    };
  }

  /**
   * Updates an existing OIDC client through the oidc-provider.
   *
   * Loads the existing client payload via the adapter, merges the updated fields,
   * re-validates through `provider.Client`, and persists.
   *
   * @param uid - The requesting user's Firebase Auth UID (must be the owner).
   * @param clientId - The client's document/adapter entry ID.
   * @param params - The fields to update.
   * @throws When the client is not found or the user is not the owner.
   */
  async updateClient(uid: string, clientId: string, params: OidcClientServiceUpdateParams): Promise<void> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const adapter: Adapter = ProviderClient.adapter;
    const existing = await adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    if (existing.uid !== uid) {
      throw new Error('Not authorized to update this client.');
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
    payload.uid = uid;
    await adapter.upsert(client.clientId, payload, 0);
  }

  /**
   * Deletes an OIDC client through the oidc-provider adapter.
   *
   * @param uid - The requesting user's Firebase Auth UID (must be the owner).
   * @param clientId - The client's document/adapter entry ID.
   * @throws When the client is not found or the user is not the owner.
   */
  async deleteClient(uid: string, clientId: string): Promise<void> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const adapter: Adapter = ProviderClient.adapter;
    const existing = await adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    if (existing.uid !== uid) {
      throw new Error('Not authorized to delete this client.');
    }

    await adapter.destroy(clientId);
  }
}
