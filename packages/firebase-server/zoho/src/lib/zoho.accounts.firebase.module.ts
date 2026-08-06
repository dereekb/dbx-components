import { type ConfigService } from '@nestjs/config';
import { type SystemStateStoredDataConverterMap } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecret, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE, type ZohoAccessTokenSystemStateDataConverterConfig, zohoAccessTokenSystemStateDataConverterFactory } from './zoho.accounts.firebase.system';

// MARK: Environment Variable Keys
/**
 * Environment variable name for the Zoho access token cache encryption secret
 * (hex-encoded AES-256 key).
 *
 * There is NO key rotation — `firestoreEncryptedField` resolves and validates the key once at
 * converter construction and closes over it. Unlike the `uecp` and `oidcJwksKey` secrets, however,
 * rotating this one is SURVIVABLE: the Zoho converter supplies an `onDecodeFailure` handler, so
 * every entry written under the old key simply degrades to a cache miss and the next Zoho call
 * re-mints a token. Rotation costs one extra token request per service key, not an outage.
 */
export const ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET_ENV_KEY = 'ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET';

/**
 * Deterministic secret used when running in a testing environment and no real secret is configured,
 * so specs never need a live credential.
 *
 * Deliberately distinct from the OIDC JWKS and UserExternalConnection testing secrets so a leaked
 * emulator blob is attributable. ("Zoho Access Token Cache Test Key", hex-encoded.)
 */
export const TESTING_ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET: AES256GCMEncryptionSecret = '5a6f686f2041636365737320546f6b656e2043616368652054657374204b6579';

// MARK: Config
/**
 * Reads the Zoho access token encryption secret from the environment.
 *
 * @param configService - The Nest config service used to read the encryption secret.
 * @param envService - Used to detect a testing environment for the secret fallback.
 * @returns The validated encryption secret.
 * @throws {Error} When the configured secret is invalid outside a testing environment.
 */
export function zohoAccessTokenEncryptionSecretFactory(configService: ConfigService, envService: FirebaseServerEnvService): AES256GCMEncryptionSecret {
  let encryptionSecret: AES256GCMEncryptionSecret = configService.get<string>(ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET_ENV_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(encryptionSecret)) {
    if (envService.isTestingEnv) {
      encryptionSecret = TESTING_ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET;
    } else {
      throw new Error(`zohoAccessTokenEncryptionSecretFactory: The secret provided by ${ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET_ENV_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  return encryptionSecret;
}

// MARK: Converter Map Entry
/**
 * Builds the converter map entry for the Zoho access token cache, for use in a SERVER-ONLY
 * SystemState converter map.
 *
 * @param config - The encryption configuration.
 * @returns A partial converter map containing only the Zoho access token entry.
 *
 * @example
 * ```typescript
 * const collections = systemStatePrivateFirestoreCollection({
 *   firestoreContext,
 *   converters: {
 *     ...zohoAccessTokenSystemStatePrivateConverterEntry({ encryptionSecret })
 *   }
 * });
 * ```
 */
export function zohoAccessTokenSystemStatePrivateConverterEntry(config: ZohoAccessTokenSystemStateDataConverterConfig): SystemStateStoredDataConverterMap {
  return {
    [ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE]: zohoAccessTokenSystemStateDataConverterFactory(config)
  };
}
