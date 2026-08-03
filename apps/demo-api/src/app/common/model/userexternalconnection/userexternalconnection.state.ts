import { type ConfigService } from '@nestjs/config';
import { type AES256GCMEncryptionSecret, createAES256GCMEncryption, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { MS_IN_MINUTE, type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Secret the external-connection OAuth `state` is encrypted with.
 *
 * Provider-agnostic on purpose: `state` is part of the OAuth 2.0 authorization-code flow itself
 * (RFC 6749 4.1.1) and every provider echoes it back opaquely, so one secret serves the whole
 * registry no matter how many providers are registered.
 *
 * Deliberately NOT the credentials secret. `USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET` is
 * write-once — rotating it makes every stored `uecp` credential permanently undecryptable — whereas
 * this one is freely rotatable, since a state lives for minutes and rotating it only invalidates
 * handoffs that are mid-flight.
 */
export const USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY = 'USER_EXTERNAL_CONNECTION_STATE_SECRET';

/**
 * Deterministic secret used when running in a testing environment and no real secret is configured,
 * so specs never need a live credential.
 */
export const TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET: AES256GCMEncryptionSecret = '45787465726e616c20436f6e6e656374696f6e2053746174652054657374204b';

/**
 * How long a minted `state` stays valid.
 *
 * Long enough for a user to work through a provider's consent screen, short enough that a leaked
 * state is not reusable later.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_STATE_EXPIRATION: Milliseconds = MS_IN_MINUTE * 10;

/**
 * The payload carried inside an encrypted external-connection OAuth `state`.
 */
export interface UserExternalConnectionStatePayload {
  /**
   * The user the handoff belongs to.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * The provider the handoff was started for.
   *
   * Verified on the way back, so a state minted to connect one provider cannot be replayed against
   * another provider's callback.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Epoch milliseconds after which the state is rejected.
   */
  readonly exp: number;
}

/**
 * Who a verified state belongs to.
 */
export interface UserExternalConnectionStateActor {
  readonly uid: FirebaseAuthUserId;
}

export interface MintUserExternalConnectionStateInput {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
}

export interface VerifyUserExternalConnectionStateInput {
  readonly state: Maybe<string>;
  /**
   * The provider whose callback is verifying. A state minted for a different provider is rejected.
   */
  readonly providerType: UserExternalConnectionProviderType;
}

export interface UserExternalConnectionStateCoderConfig {
  readonly secret: AES256GCMEncryptionSecret;
  /**
   * How long a minted state stays valid. Defaults to {@link DEFAULT_USER_EXTERNAL_CONNECTION_STATE_EXPIRATION}.
   */
  readonly expiresIn?: Maybe<Milliseconds>;
}

export interface UserExternalConnectionStateCoder {
  /**
   * Mints a short-lived state for a user's connect handoff with a provider.
   */
  readonly mintState: (input: MintUserExternalConnectionStateInput) => string;
  /**
   * Resolves the user a state belongs to, or null when it is absent, tampered with, expired, or was
   * minted for a different provider.
   */
  readonly verifyState: (input: VerifyUserExternalConnectionStateInput) => Maybe<UserExternalConnectionStateActor>;
}

/**
 * Converts standard base64 to base64url, so the state survives a round trip through a third party
 * without depending on how it re-encodes `+`, `/`, and `=`.
 *
 * @param value - The base64 string to convert.
 * @returns The equivalent base64url string.
 */
function base64ToBase64Url(value: string): string {
  return value.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBase64(value: string): string {
  return value.replaceAll('-', '+').replaceAll('_', '/');
}

/**
 * Creates the coder that mints and verifies the OAuth `state` for external-connection handoffs.
 *
 * The state is what lets a provider's redirect back to us be attributed to a user: the authorize
 * request is a top-level browser navigation and carries no credentials of its own. Tamper-evidence
 * is the requirement; AES-256-GCM is used because its auth tag provides that and additionally keeps
 * the uid opaque to the browser.
 *
 * @param config - The encryption secret and optional expiration.
 * @returns The state coder.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionStateCoder(config: UserExternalConnectionStateCoderConfig): UserExternalConnectionStateCoder {
  const { secret, expiresIn: inputExpiresIn } = config;
  const expiresIn = inputExpiresIn ?? DEFAULT_USER_EXTERNAL_CONNECTION_STATE_EXPIRATION;
  const encryption = createAES256GCMEncryption(secret);

  function mintState(input: MintUserExternalConnectionStateInput): string {
    const payload: UserExternalConnectionStatePayload = { uid: input.uid, providerType: input.providerType, exp: Date.now() + expiresIn };
    return base64ToBase64Url(encryption.encryptValue(payload));
  }

  function verifyState(input: VerifyUserExternalConnectionStateInput): Maybe<UserExternalConnectionStateActor> {
    const { state, providerType } = input;
    let result: Maybe<UserExternalConnectionStateActor>;

    if (state) {
      try {
        const payload = encryption.decryptValue<UserExternalConnectionStatePayload>(base64UrlToBase64(state));

        if (payload?.uid && payload.providerType === providerType && payload.exp > Date.now()) {
          result = { uid: payload.uid };
        }
      } catch {
        // a state that fails to decrypt was tampered with or minted under another secret
      }
    }

    return result;
  }

  return { mintState, verifyState };
}

// MARK: Config
/**
 * Injection token for the app's {@link UserExternalConnectionStateCoder}.
 *
 * Declared as an abstract class so it is its own token, matching `UserExternalConnectionModuleConfig`.
 */
export abstract class DemoApiUserExternalConnectionStateCoder implements UserExternalConnectionStateCoder {
  abstract readonly mintState: UserExternalConnectionStateCoder['mintState'];
  abstract readonly verifyState: UserExternalConnectionStateCoder['verifyState'];
}

/**
 * Builds the external-connection state coder from the environment.
 *
 * @param configService - The Nest config service used to read the state secret.
 * @param envService - Used to detect a testing environment for the secret fallback.
 * @returns The state coder.
 * @throws {Error} When the configured secret is invalid outside a testing environment.
 */
export function demoApiUserExternalConnectionStateCoderFactory(configService: ConfigService, envService: FirebaseServerEnvService): DemoApiUserExternalConnectionStateCoder {
  let secret: AES256GCMEncryptionSecret = configService.get<string>(USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(secret)) {
    if (envService.isTestingEnv) {
      secret = TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET;
    } else {
      throw new Error(`demoApiUserExternalConnectionStateCoderFactory: The secret provided by ${USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  return userExternalConnectionStateCoder({ secret });
}
