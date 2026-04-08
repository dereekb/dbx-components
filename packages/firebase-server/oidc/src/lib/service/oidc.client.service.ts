import { type CreateOidcClientParams, type CreateOidcClientResult, type UpdateOidcClientParams, type RotateOidcClientSecretResult, type OidcEntryClientId, oidcEntryIdentity, firestoreModelKey } from '@dereekb/firebase';
import type { ClientMetadata } from 'oidc-provider';
import { nanoid } from 'nanoid';
import { randomBytes } from 'node:crypto';
import { type OidcService } from './oidc.service';

// MARK: Service
/**
 * Service for managing OIDC client registrations through the oidc-provider.
 *
 * Mirrors the oidc-provider `registration.js` flow to ensure all provider
 * validation and lifecycle hooks run.
 */
export class OidcClientService {
  constructor(private readonly oidcService: OidcService) {}

  /**
   * Creates a new OIDC client through the oidc-provider.
   *
   * Generates `client_id` and `client_secret` using the same defaults as oidc-provider's
   * registration flow, validates via `Client.validate`, and persists through the adapter.
   *
   * @param params - Client registration parameters.
   * @param validatedMetadata - Optional pre-validated metadata to merge into the client properties.
   *   Use this for server-side fields (e.g., inline `jwks`) that have already been validated
   *   and should not be exposed through the API params.
   * @returns The generated client ID and secret (plaintext, returned only once).
   */
  async createClient(params: CreateOidcClientParams, validatedMetadata?: Partial<Pick<ClientMetadata, 'jwks'>>): Promise<CreateOidcClientResult> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;

    // Mirrors oidc-provider's default idFactory from lib/helpers/defaults.js
    const clientId = nanoid();
    const firestoreOwnerKey = params.key;
    const properties: ClientMetadata = {
      client_name: params.client_name,
      redirect_uris: params.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'] as ClientMetadata['response_types'],
      token_endpoint_auth_method: params.token_endpoint_auth_method,
      client_id: clientId
    };

    // Pass optional metadata fields
    if (params.logo_uri) {
      properties.logo_uri = params.logo_uri;
    }

    if (params.client_uri) {
      properties.client_uri = params.client_uri;
    }

    if (params.jwks_uri) {
      properties.jwks_uri = params.jwks_uri;
    }

    // Merge any pre-validated metadata (e.g., inline jwks for private_key_jwt in tests)
    if (validatedMetadata?.jwks) {
      properties.jwks = validatedMetadata.jwks;
    }

    // Mirrors oidc-provider's registration.js: only generate a secret when the auth method requires one.
    // Uses Client.needsSecret() from lib/models/client.js and the default secretFactory from lib/helpers/defaults.js.
    let clientSecret: string | undefined;

    if (ProviderClient.needsSecret(properties)) {
      clientSecret = randomBytes(64).toString('base64url');
      properties.client_secret = clientSecret;
      properties.client_secret_expires_at = 0;
    }

    // Mirrors oidc-provider's lib/helpers/add_client.js: validates metadata (including sectorIdentifierUri)
    // via Client.validate(), constructs the Client, and persists via adapter.upsert().
    await ProviderClient.validate(properties);
    const client = new ProviderClient(properties);

    // firestoreOwnerKey is not part of the oidc-provider metadata schema, so we attach it
    // to the payload after metadata() strips unrecognized fields. The adapter reads this
    // to set OidcEntry.o for firestore security rules.
    const payload = client.metadata();
    payload.firestoreOwnerKey = firestoreOwnerKey;
    await ProviderClient.adapter.upsert(client.clientId, payload);

    return {
      modelKeys: firestoreModelKey(oidcEntryIdentity, clientId),
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
   * `token_endpoint_auth_method` is immutable and cannot be changed.
   *
   * @param clientId - The client's document/adapter entry ID.
   * @param params - The fields to update.
   * @throws When the client is not found.
   */
  async updateClient(clientId: OidcEntryClientId, params: Omit<UpdateOidcClientParams, 'key'>): Promise<void> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const existing = await ProviderClient.adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    const updatedMetadata = { ...existing };
    updatedMetadata.client_name = params.client_name;
    updatedMetadata.redirect_uris = params.redirect_uris;

    if (params.logo_uri !== undefined) {
      updatedMetadata.logo_uri = params.logo_uri ?? undefined;
    }

    if (params.client_uri !== undefined) {
      updatedMetadata.client_uri = params.client_uri ?? undefined;
    }

    // Mirrors oidc-provider's lib/helpers/add_client.js: re-validates and persists.
    await ProviderClient.validate(updatedMetadata);
    const client = new ProviderClient(updatedMetadata);
    await ProviderClient.adapter.upsert(client.clientId, client.metadata());
  }

  /**
   * Rotates the client secret for an existing OIDC client.
   *
   * Generates a new `client_secret`, re-validates via `Client.validate()`, and persists.
   * The new secret is returned in plaintext — this is the only time it is available.
   *
   * @param clientId - The client's document/adapter entry ID.
   * @returns The client ID and new secret (plaintext, returned only once).
   * @throws When the client is not found.
   */
  async rotateClientSecret(clientId: OidcEntryClientId): Promise<RotateOidcClientSecretResult> {
    const provider = await this.oidcService.getProvider();
    const ProviderClient = provider.Client as any;
    const existing = await ProviderClient.adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    const newSecret = randomBytes(64).toString('base64url');
    const updatedMetadata = { ...existing, client_secret: newSecret, client_secret_expires_at: 0 };

    await ProviderClient.validate(updatedMetadata);
    const client = new ProviderClient(updatedMetadata);
    await ProviderClient.adapter.upsert(client.clientId, client.metadata());

    return {
      client_id: clientId,
      client_secret: newSecret
    };
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
    const existing = await ProviderClient.adapter.find(clientId);

    if (!existing) {
      throw new Error('Client not found.');
    }

    await ProviderClient.adapter.destroy(clientId);
  }
}
