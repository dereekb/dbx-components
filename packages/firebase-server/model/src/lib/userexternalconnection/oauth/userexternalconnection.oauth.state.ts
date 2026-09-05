import { timingSafeEqual } from 'node:crypto';
import { type ConfigService } from '@nestjs/config';
import { type AES256GCMEncryptionSecret, createAES256GCMEncryption, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { generatePkceCodeChallenge, MS_IN_MINUTE, type Maybe, type Milliseconds } from '@dereekb/util';

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
 * How long a minted sign-in ticket stays valid.
 *
 * Far shorter than a state: the ticket is redeemed by a page that has just been redirected to, so the
 * whole window is one client-side navigation plus one POST.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_TICKET_EXPIRATION: Milliseconds = MS_IN_MINUTE * 2;

/**
 * Which direction a handoff runs in.
 *
 * - `connect` — an ALREADY authenticated user is attaching a third-party account. The state carries
 *   their uid, minted by an authenticated call before the redirect.
 * - `signin` — an anonymous visitor is authenticating THROUGH the third party. There is no uid yet;
 *   the state carries a client-supplied PKCE challenge instead, which the ticket exchange answers.
 */
export type UserExternalConnectionStateMode = 'connect' | 'signin';

/**
 * Fields shared by both {@link UserExternalConnectionStatePayload} branches.
 */
export interface UserExternalConnectionStatePayloadBase {
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
  /**
   * The PKCE code verifier the authorize request sent the challenge for — the PROVIDER-facing half
   * of the flow, unrelated to `challenge` below.
   *
   * Held here rather than in a server-side store because the state is already an
   * encrypted-and-authenticated envelope only this server can read, which is exactly what a verifier
   * needs. Optional so a state minted before PKCE was added still exchanges.
   */
  readonly cv?: Maybe<string>;
}

/**
 * A `connect` state: an authenticated user attaching a provider.
 */
export interface UserExternalConnectionConnectStatePayload extends UserExternalConnectionStatePayloadBase {
  /**
   * Absent on states minted before sign-in mode existed, which is why an ABSENT mode means `connect`
   * — a state already in flight when this shipped must still verify.
   */
  readonly mode?: Maybe<'connect'>;
  /**
   * The user the handoff belongs to.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * A `signin` state: an anonymous visitor authenticating through a provider.
 */
export interface UserExternalConnectionSignInStatePayload extends UserExternalConnectionStatePayloadBase {
  readonly mode: 'signin';
  /**
   * The CLIENT's PKCE challenge (base64url SHA-256 of a verifier held in the browser).
   *
   * Binds the eventual ticket to the browser that started the flow: a stolen ticket is useless
   * without the verifier, which never leaves the originating tab.
   */
  readonly challenge: string;
  /**
   * Optional app path to return to, already validated against the app's allowlist before minting.
   */
  readonly returnPath?: Maybe<string>;
}

/**
 * The payload carried inside an encrypted external-connection OAuth `state`.
 */
export type UserExternalConnectionStatePayload = UserExternalConnectionConnectStatePayload | UserExternalConnectionSignInStatePayload;

/**
 * The payload carried inside an encrypted sign-in ticket.
 *
 * Shares the state's secret and envelope, and is distinguished from it by {@link USER_EXTERNAL_CONNECTION_TICKET_PAYLOAD_TYPE}:
 * without that tag a captured state could be submitted where a ticket is expected.
 */
export interface UserExternalConnectionSignInTicketPayload {
  readonly t: typeof USER_EXTERNAL_CONNECTION_TICKET_PAYLOAD_TYPE;
  /**
   * The Firebase custom token to hand back once the verifier proves possession.
   */
  readonly customToken: string;
  /**
   * The same client challenge the state carried.
   */
  readonly challenge: string;
  /**
   * The user the token was minted for. Returned only for logging/telemetry at the redemption site.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * Epoch milliseconds after which the ticket is rejected.
   */
  readonly exp: number;
}

/**
 * Type tag distinguishing a ticket payload from a state payload under the shared secret.
 */
export const USER_EXTERNAL_CONNECTION_TICKET_PAYLOAD_TYPE = 'uec-signin-ticket';

/**
 * A verified `connect` state — the user it belongs to.
 */
export interface UserExternalConnectionConnectStateActor {
  readonly mode: 'connect';
  readonly uid: FirebaseAuthUserId;
  readonly codeVerifier?: Maybe<string>;
}

/**
 * A verified `signin` state. Carries no uid: resolving one is the callback's job.
 */
export interface UserExternalConnectionSignInStateActor {
  readonly mode: 'signin';
  readonly challenge: string;
  readonly codeVerifier?: Maybe<string>;
  readonly returnPath?: Maybe<string>;
}

/**
 * Who (or what) a verified state belongs to.
 */
export type UserExternalConnectionStateActor = UserExternalConnectionConnectStateActor | UserExternalConnectionSignInStateActor;

/**
 * Returns whether a verified actor came from a `signin` state.
 *
 * @param actor - The verified actor to narrow.
 * @returns True when the actor is a sign-in actor.
 */
export function isUserExternalConnectionSignInStateActor(actor: Maybe<UserExternalConnectionStateActor>): actor is UserExternalConnectionSignInStateActor {
  return actor?.mode === 'signin';
}

export interface MintUserExternalConnectionConnectStateInput {
  readonly mode?: Maybe<'connect'>;
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The PKCE code verifier whose challenge the authorize request sends to the provider.
   */
  readonly codeVerifier?: Maybe<string>;
}

export interface MintUserExternalConnectionSignInStateInput {
  readonly mode: 'signin';
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The client's PKCE challenge, already validated as present.
   */
  readonly challenge: string;
  readonly returnPath?: Maybe<string>;
  readonly codeVerifier?: Maybe<string>;
}

export type MintUserExternalConnectionStateInput = MintUserExternalConnectionConnectStateInput | MintUserExternalConnectionSignInStateInput;

export interface VerifyUserExternalConnectionStateInput {
  readonly state: Maybe<string>;
  /**
   * The provider whose callback is verifying. A state minted for a different provider is rejected.
   */
  readonly providerType: UserExternalConnectionProviderType;
}

export interface MintUserExternalConnectionTicketInput {
  readonly customToken: string;
  readonly challenge: string;
  readonly uid: FirebaseAuthUserId;
}

export interface VerifyUserExternalConnectionTicketInput {
  readonly ticket: Maybe<string>;
  /**
   * The PKCE code verifier the browser retained. Hashed and compared to the ticket's challenge.
   */
  readonly verifier: Maybe<string>;
}

/**
 * A redeemed sign-in ticket.
 */
export interface UserExternalConnectionSignInTicket {
  readonly customToken: string;
  readonly uid: FirebaseAuthUserId;
}

export interface UserExternalConnectionStateCoderConfig {
  readonly secret: AES256GCMEncryptionSecret;
  /**
   * How long a minted state stays valid. Defaults to {@link DEFAULT_USER_EXTERNAL_CONNECTION_STATE_EXPIRATION}.
   */
  readonly expiresIn?: Maybe<Milliseconds>;
  /**
   * How long a minted sign-in ticket stays valid. Defaults to {@link DEFAULT_USER_EXTERNAL_CONNECTION_TICKET_EXPIRATION}.
   */
  readonly ticketExpiresIn?: Maybe<Milliseconds>;
}

/**
 * Mints and verifies the OAuth `state` for external-connection handoffs.
 *
 * Declared as an abstract class so it is its own injection token, matching
 * `UserExternalConnectionModuleConfig`. One coder is shared by every registered provider.
 */
export abstract class UserExternalConnectionStateCoder {
  /**
   * Mints a short-lived state for a connect or sign-in handoff with a provider.
   */
  abstract readonly mintState: (input: MintUserExternalConnectionStateInput) => string;
  /**
   * Resolves who a state belongs to, or null when it is absent, tampered with, expired, or was minted
   * for a different provider.
   */
  abstract readonly verifyState: (input: VerifyUserExternalConnectionStateInput) => Maybe<UserExternalConnectionStateActor>;
  /**
   * Mints a short-lived ticket carrying a custom token, redeemable only by the browser holding the
   * verifier for its challenge.
   *
   * The ticket exists so the custom token never rides in a URL, where it would land in browser
   * history, the Referer header, and any proxy's access log.
   */
  abstract readonly mintTicket: (input: MintUserExternalConnectionTicketInput) => string;
  /**
   * Redeems a ticket against the verifier the browser retained, or resolves null when the ticket is
   * absent, tampered with, expired, or the verifier does not answer its challenge.
   */
  abstract readonly verifyTicket: (input: VerifyUserExternalConnectionTicketInput) => Promise<Maybe<UserExternalConnectionSignInTicket>>;
}

/**
 * Compares two strings in constant time relative to their contents.
 *
 * A plain `===` on a PKCE challenge leaks how many leading characters an attacker guessed correctly,
 * which is the whole game when the value being guessed is a fixed-length digest.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns True when the values are byte-identical.
 */
function timingSafeStringEquals(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, 'utf8');
  const bBytes = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on a length mismatch, and a length difference is not secret
  return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);
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
  const { secret, expiresIn: inputExpiresIn, ticketExpiresIn: inputTicketExpiresIn } = config;
  const expiresIn = inputExpiresIn ?? DEFAULT_USER_EXTERNAL_CONNECTION_STATE_EXPIRATION;
  const ticketExpiresIn = inputTicketExpiresIn ?? DEFAULT_USER_EXTERNAL_CONNECTION_TICKET_EXPIRATION;
  const encryption = createAES256GCMEncryption(secret);

  function mintState(input: MintUserExternalConnectionStateInput): string {
    const exp = Date.now() + expiresIn;
    const payload: UserExternalConnectionStatePayload =
      input.mode === 'signin' ? { mode: 'signin', providerType: input.providerType, challenge: input.challenge, returnPath: input.returnPath, cv: input.codeVerifier, exp } : { mode: 'connect', uid: input.uid, providerType: input.providerType, cv: input.codeVerifier, exp };

    return base64ToBase64Url(encryption.encryptValue(payload));
  }

  function verifyState(input: VerifyUserExternalConnectionStateInput): Maybe<UserExternalConnectionStateActor> {
    const { state, providerType } = input;
    let result: Maybe<UserExternalConnectionStateActor>;

    if (state) {
      try {
        const payload = encryption.decryptValue<UserExternalConnectionStatePayload>(base64UrlToBase64(state));

        // an ABSENT mode is `connect`: states minted before sign-in mode existed carry no mode and
        // must keep verifying while they are in flight
        if (payload?.providerType === providerType && payload.exp > Date.now()) {
          if (payload.mode === 'signin') {
            if (payload.challenge) {
              result = { mode: 'signin', challenge: payload.challenge, returnPath: payload.returnPath, codeVerifier: payload.cv };
            }
          } else if (payload.uid) {
            result = { mode: 'connect', uid: payload.uid, codeVerifier: payload.cv };
          }
        }
      } catch {
        // a state that fails to decrypt was tampered with or minted under another secret
      }
    }

    return result;
  }

  function mintTicket(input: MintUserExternalConnectionTicketInput): string {
    const payload: UserExternalConnectionSignInTicketPayload = {
      t: USER_EXTERNAL_CONNECTION_TICKET_PAYLOAD_TYPE,
      customToken: input.customToken,
      challenge: input.challenge,
      uid: input.uid,
      exp: Date.now() + ticketExpiresIn
    };

    return base64ToBase64Url(encryption.encryptValue(payload));
  }

  async function verifyTicket(input: VerifyUserExternalConnectionTicketInput): Promise<Maybe<UserExternalConnectionSignInTicket>> {
    const { ticket, verifier } = input;
    let result: Maybe<UserExternalConnectionSignInTicket>;

    if (ticket && verifier) {
      try {
        const payload = encryption.decryptValue<UserExternalConnectionSignInTicketPayload>(base64UrlToBase64(ticket));

        // the type tag is what stops a captured `state` being submitted where a ticket is expected —
        // both are sealed with the same secret
        if (payload?.t === USER_EXTERNAL_CONNECTION_TICKET_PAYLOAD_TYPE && payload.customToken && payload.challenge && payload.exp > Date.now()) {
          const challenge = await generatePkceCodeChallenge(verifier);

          if (timingSafeStringEquals(challenge, payload.challenge)) {
            result = { customToken: payload.customToken, uid: payload.uid };
          }
        }
      } catch {
        // a ticket that fails to decrypt was tampered with or minted under another secret
      }
    }

    return result;
  }

  return { mintState, verifyState, mintTicket, verifyTicket };
}

/**
 * Builds the external-connection state coder from the environment.
 *
 * @param configService - The Nest config service used to read the state secret.
 * @param envService - Used to detect a testing environment for the secret fallback.
 * @returns The state coder.
 * @throws {Error} When the configured secret is invalid outside a testing environment.
 */
export function userExternalConnectionStateCoderFactory(configService: ConfigService, envService: FirebaseServerEnvService): UserExternalConnectionStateCoder {
  let secret: AES256GCMEncryptionSecret = configService.get<string>(USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(secret)) {
    if (envService.isTestingEnv) {
      secret = TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET;
    } else {
      throw new Error(`userExternalConnectionStateCoderFactory: The secret provided by ${USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  return userExternalConnectionStateCoder({ secret });
}
