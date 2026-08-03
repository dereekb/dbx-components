import { type AES256GCMEncryptionSecretSource, createAES256GCMEncryption } from '@dereekb/nestjs';
import { type CalcomOAuthCallbackActor, type CalcomOAuthState } from '@dereekb/calcom/nestjs';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { MS_IN_MINUTE, type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * How long a minted `state` stays valid.
 *
 * Long enough for a user to work through the Cal.com consent screen, short enough that a leaked
 * state is not reusable later.
 */
export const DEFAULT_DEMO_CALCOM_OAUTH_STATE_EXPIRATION: Milliseconds = MS_IN_MINUTE * 10;

/**
 * The payload carried inside an encrypted Cal.com OAuth `state`.
 */
export interface DemoCalcomOAuthStatePayload {
  /**
   * The user the handoff belongs to.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * Epoch milliseconds after which the state is rejected.
   */
  readonly exp: number;
}

export interface DemoCalcomOAuthStateCoderConfig {
  /**
   * The AES-256 secret the state is encrypted with.
   */
  readonly secret: AES256GCMEncryptionSecretSource;
  /**
   * How long a minted state stays valid. Defaults to {@link DEFAULT_DEMO_CALCOM_OAUTH_STATE_EXPIRATION}.
   */
  readonly expiresIn?: Maybe<Milliseconds>;
}

export interface DemoCalcomOAuthStateCoder {
  /**
   * Mints a short-lived state for the given user.
   */
  readonly mintState: (uid: FirebaseAuthUserId) => CalcomOAuthState;
  /**
   * Resolves the user a state belongs to, or null when it is absent, tampered with, or expired.
   */
  readonly verifyState: (state: Maybe<CalcomOAuthState>) => Maybe<CalcomOAuthCallbackActor>;
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
 * Creates the coder that mints and verifies the Cal.com OAuth `state`.
 *
 * AES-256-GCM is used rather than a bare signature: the auth tag makes a tampered state fail to
 * decrypt at all, and the uid inside is not exposed to the user's browser along the way.
 *
 * @param config - The encryption secret and optional expiration.
 * @returns The state coder.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoCalcomOAuthStateCoder(config: DemoCalcomOAuthStateCoderConfig): DemoCalcomOAuthStateCoder {
  const { secret, expiresIn: inputExpiresIn } = config;
  const expiresIn = inputExpiresIn ?? DEFAULT_DEMO_CALCOM_OAUTH_STATE_EXPIRATION;
  const encryption = createAES256GCMEncryption(secret);

  function mintState(uid: FirebaseAuthUserId): CalcomOAuthState {
    const payload: DemoCalcomOAuthStatePayload = { uid, exp: Date.now() + expiresIn };
    return base64ToBase64Url(encryption.encryptValue(payload));
  }

  function verifyState(state: Maybe<CalcomOAuthState>): Maybe<CalcomOAuthCallbackActor> {
    let result: Maybe<CalcomOAuthCallbackActor>;

    if (state) {
      try {
        const payload = encryption.decryptValue<DemoCalcomOAuthStatePayload>(base64UrlToBase64(state));

        if (payload?.uid && payload.exp > Date.now()) {
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
