import { type ConfigService } from '@nestjs/config';
import { type AES256GCMEncryptionSecret, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type DemoCalcomOAuthStateCoder, demoCalcomOAuthStateCoder } from './calcom.state';

/**
 * Secret the Cal.com OAuth `state` is encrypted with.
 *
 * Unlike the connection-credentials secret this one IS safe to rotate: a state lives for minutes, so
 * rotating it only invalidates handoffs that are mid-flight.
 */
export const CALCOM_OAUTH_STATE_SECRET_CONFIG_KEY = 'CALCOM_OAUTH_STATE_SECRET';

/**
 * Deterministic secret used when running in a testing environment and no real secret is configured,
 * so specs never need a live credential.
 */
export const TESTING_CALCOM_OAUTH_STATE_SECRET: AES256GCMEncryptionSecret = '43616c636f6d204f4175746820537461746520546573742044656d6f204b6579';

/**
 * Injection token for the app's {@link DemoCalcomOAuthStateCoder}.
 *
 * Declared as an abstract class so it is its own token, matching the newer style used by
 * `DbxFirebaseExternalConnectionsConfig` and `UserExternalConnectionModuleConfig`.
 */
export abstract class DemoApiCalcomOAuthStateCoder implements DemoCalcomOAuthStateCoder {
  abstract readonly mintState: DemoCalcomOAuthStateCoder['mintState'];
  abstract readonly verifyState: DemoCalcomOAuthStateCoder['verifyState'];
}

/**
 * Builds the Cal.com OAuth state coder from the environment.
 *
 * @param configService - The Nest config service used to read the state secret.
 * @param envService - Used to detect a testing environment for the secret fallback.
 * @returns The state coder.
 * @throws {Error} When the configured secret is invalid outside a testing environment.
 */
export function demoApiCalcomOAuthStateCoderFactory(configService: ConfigService, envService: FirebaseServerEnvService): DemoApiCalcomOAuthStateCoder {
  let secret: AES256GCMEncryptionSecret = configService.get<string>(CALCOM_OAUTH_STATE_SECRET_CONFIG_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(secret)) {
    if (envService.isTestingEnv) {
      secret = TESTING_CALCOM_OAUTH_STATE_SECRET;
    } else {
      throw new Error(`demoApiCalcomOAuthStateCoderFactory: The secret provided by ${CALCOM_OAUTH_STATE_SECRET_CONFIG_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  return demoCalcomOAuthStateCoder({ secret });
}
