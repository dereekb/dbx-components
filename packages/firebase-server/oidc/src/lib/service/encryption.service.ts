import { Inject, Injectable } from '@nestjs/common';
import { OidcModuleConfig } from '../oidc.config';
import { createAesStringEncryptionProvider } from '@dereekb/nestjs';
import { filterUndefinedValues, selectiveFieldEncryptor, type SelectiveFieldEncryptor, type StringEncryptionProvider, type JsonSerializableObject } from '@dereekb/util';
import type { AdapterPayload } from 'oidc-provider';

// MARK: Encrypted Fields
/**
 * Adapter payload fields that contain sensitive values and are selectively encrypted at rest.
 *
 * - `client_secret`: OAuth client secret (present on Client entries)
 * - `registration_access_token`: DCR access token (present on Client entries)
 */
export const OIDC_ENCRYPTED_PAYLOAD_FIELDS = ['client_secret', 'registration_access_token'] as const;

/**
 * Union of adapter payload field names that are selectively encrypted.
 */
export type OidcEncryptedPayloadField = (typeof OIDC_ENCRYPTED_PAYLOAD_FIELDS)[number];

// MARK: Client Payload
/**
 * Loosely-typed adapter payload with known sensitive fields.
 */
export interface OidcClientPayload {
  client_id: string;
  client_secret?: string;
  registration_access_token?: string;
  [key: string]: unknown;
}

/**
 * Selective field encryptor for oidc-provider adapter and client payloads.
 *
 * Both adapter payloads and client payloads share the same encrypted fields,
 * so a single encryptor type is used for both.
 */
export type OidcAdapterPayloadEncryptor = SelectiveFieldEncryptor<AdapterPayload, OidcEncryptedPayloadField>;

// MARK: Service
/**
 * Centralized encryption service for OIDC payload fields.
 *
 * Provides a single {@link StringEncryptionProvider} and pre-built selective field encryptors
 * for both the oidc-provider adapter payloads and client CRUD payloads. This avoids
 * duplicating encryption setup across {@link OidcService}, the adapter factory, and
 * the OIDC model server actions.
 */
@Injectable()
export class OidcEncryptionService {
  readonly provider: StringEncryptionProvider;
  readonly adapterPayloadEncryptor: OidcAdapterPayloadEncryptor;

  constructor(@Inject(OidcModuleConfig) config: OidcModuleConfig) {
    this.provider = createAesStringEncryptionProvider(config.jwksKeyConverterConfig.encryptionSecret);

    this.adapterPayloadEncryptor = selectiveFieldEncryptor<AdapterPayload, OidcEncryptedPayloadField>({
      provider: this.provider,
      fields: [...OIDC_ENCRYPTED_PAYLOAD_FIELDS]
    });
  }

  /**
   * Encrypts sensitive fields in an adapter payload and returns it as a {@link JsonSerializableObject}
   * suitable for storing directly in Firestore.
   */
  encryptAdapterPayload(payload: AdapterPayload): JsonSerializableObject {
    const filtered = filterUndefinedValues(payload);
    return this.adapterPayloadEncryptor.encrypt(filtered) as JsonSerializableObject;
  }

  /**
   * Decrypts sensitive fields in a Firestore-stored payload object back to an {@link AdapterPayload}.
   */
  decryptAdapterPayload(payload: JsonSerializableObject): AdapterPayload {
    return this.adapterPayloadEncryptor.decrypt(payload as any) as AdapterPayload;
  }
}
