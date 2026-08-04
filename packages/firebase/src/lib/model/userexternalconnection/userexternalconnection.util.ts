import { type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common';
import { type UserExternalConnection, type UserExternalConnectionEntry, type UserExternalConnectionEntryMap, type UserExternalConnectionEntryStatus, type UserExternalConnectionErrorCode } from './userexternalconnection';
import { type UserExternalConnectionCapability, type UserExternalConnectionExternalAccountId, type UserExternalConnectionProviderType } from './userexternalconnection.id';

/**
 * The facts about a granted third-party authorization that a {@link UserExternalConnectionEntry} is
 * allowed to summarize.
 *
 * This is projected from the stored credentials by the server (see
 * `userExternalConnectionGrantSummaryFromCredentials` in `@dereekb/firebase-server/model`), never
 * assembled by a caller. That is what makes it impossible for the client-readable summary to claim
 * scopes, an account, or an expiration the credentials do not actually have.
 */
export interface UserExternalConnectionGrantSummary {
  readonly scopes?: Maybe<UserExternalConnectionCapability[]>;
  readonly externalAccountId?: Maybe<UserExternalConnectionExternalAccountId>;
  readonly label?: Maybe<string>;
  readonly connectedAt?: Maybe<Date>;
  readonly expiresAt?: Maybe<Date>;
}

// MARK: Derivation
/**
 * The SOLE producer of a {@link UserExternalConnection}'s `c` array.
 *
 * Membership is exactly the provider types whose entry status is `connected`. `disconnected` and
 * `error` entries are excluded — the array backs a "which users can I actually call X for?" query,
 * and `array-contains` has no way to filter by status afterwards.
 *
 * @param entries - The per-provider entry map to derive from.
 * @returns The connected provider types, sorted for a stable stored value.
 */
export function userExternalConnectionConnectedProviderTypes(entries: Maybe<UserExternalConnectionEntryMap>): UserExternalConnectionProviderType[] {
  const result = entries ? Object.keys(entries).filter((x) => entries[x]?.st === 'connected') : [];
  result.sort();
  return result;
}

/**
 * Input for {@link userExternalConnectionEntryForOutcome}.
 *
 * NOTE the shape: there is no parameter for any entry field. `ca`/`ea`/`l`/`exa` are copied off the
 * `grant` (which is itself projected from the credentials), and `st`/`coa`/`uat` are computed. A
 * caller has no way to describe a connection the credentials do not support.
 */
export interface UserExternalConnectionEntryForOutcomeInput {
  /**
   * The outcome of the operation that produced (or removed) the credentials.
   */
  readonly outcome: UserExternalConnectionEntryStatus;
  /**
   * Summary of the grant the credentials carry. Required in practice for a `connected` outcome.
   */
  readonly grant?: Maybe<UserExternalConnectionGrantSummary>;
  /**
   * Reason for an `error` outcome. Defaults to `unknown`.
   */
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
  /**
   * The entry currently stored for this provider, when there is one.
   */
  readonly previous?: Maybe<UserExternalConnectionEntry>;
  /**
   * Whether a `disconnected` outcome should retain a history entry rather than removing the key.
   *
   * Defaults to false.
   */
  readonly retainEntry?: Maybe<boolean>;
  /**
   * The instant the operation is being applied at.
   */
  readonly now: Date;
}

/**
 * Derives the {@link UserExternalConnectionEntry} for an operation's outcome.
 *
 * @param input - The outcome plus the grant it derives from.
 * @returns The next entry, or null when the provider's entry should be REMOVED from the map.
 */
export function userExternalConnectionEntryForOutcome(input: UserExternalConnectionEntryForOutcomeInput): Maybe<UserExternalConnectionEntry> {
  const { outcome, grant, error, previous, retainEntry, now } = input;
  let result: Maybe<UserExternalConnectionEntry> = null;

  switch (outcome) {
    case 'connected':
      result = {
        st: 'connected',
        ca: grant?.scopes,
        ea: grant?.externalAccountId,
        l: grant?.label,
        coa: previous?.coa ?? grant?.connectedAt ?? now,
        exa: grant?.expiresAt,
        uat: now,
        er: null
      };
      break;
    case 'error':
      // an errored connection keeps describing the account it was connected to, so the UI can say
      // which account needs attention.
      result = {
        st: 'error',
        ca: grant?.scopes ?? previous?.ca,
        ea: grant?.externalAccountId ?? previous?.ea,
        l: grant?.label ?? previous?.l,
        coa: previous?.coa ?? grant?.connectedAt,
        exa: grant?.expiresAt ?? previous?.exa,
        uat: now,
        er: error ?? 'unknown'
      };
      break;
    case 'disconnected':
      result = retainEntry
        ? {
            st: 'disconnected',
            ca: null,
            ea: previous?.ea,
            l: previous?.l,
            coa: previous?.coa,
            exa: null,
            uat: now,
            er: null
          }
        : null;
      break;
  }

  return result;
}

/**
 * Input for {@link applyUserExternalConnectionEntry}.
 */
export interface ApplyUserExternalConnectionEntryInput {
  /**
   * The currently stored document, when one exists.
   */
  readonly current?: Maybe<UserExternalConnection>;
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The next entry for this provider, or null to remove the provider's key entirely.
   */
  readonly entry: Maybe<UserExternalConnectionEntry>;
  readonly now: Date;
}

/**
 * Applies a single provider's entry and returns the COMPLETE next document.
 *
 * Returning the whole value (rather than a patch) is what keeps `c` honest: this is the only
 * exported way to change `e`, and it always recomputes `c` from the resulting map. There is no
 * exported path that touches one without the other.
 *
 * @param input - The current document plus the provider entry to apply.
 * @returns The next UserExternalConnection value to write.
 */
export function applyUserExternalConnectionEntry(input: ApplyUserExternalConnectionEntryInput): UserExternalConnection {
  const { current, uid, providerType, entry, now } = input;
  const entries: UserExternalConnectionEntryMap = { ...current?.e };

  if (entry) {
    entries[providerType] = entry;
  } else {
    delete entries[providerType];
  }

  return {
    uid,
    e: entries,
    c: userExternalConnectionConnectedProviderTypes(entries),
    uat: now
  };
}

/**
 * Input for {@link emptyUserExternalConnection}.
 */
export interface EmptyUserExternalConnectionInput {
  readonly uid: FirebaseAuthUserId;
  readonly now: Date;
}

/**
 * Returns the value of a connection document that has no providers on it yet.
 *
 * Creating the document is its own operation, so the "no connections" value lives here beside
 * {@link applyUserExternalConnectionEntry} rather than as a literal at the call site — both write
 * the complete document, and `c` is empty here for the same reason it is derived there.
 *
 * @param input - The user the document belongs to and the instant to stamp it with.
 * @returns The UserExternalConnection value for a user with no provider entries.
 */
export function emptyUserExternalConnection(input: EmptyUserExternalConnectionInput): UserExternalConnection {
  const { uid, now } = input;

  return {
    uid,
    e: {},
    c: [],
    uat: now
  };
}

// MARK: Display
/**
 * Returns the entry for the given provider, if any.
 *
 * @param connection - The loaded connection document.
 * @param providerType - The provider to read.
 * @returns The provider's entry, or null when the user has no entry for it.
 */
export function userExternalConnectionEntryForProvider(connection: Maybe<UserExternalConnection>, providerType: UserExternalConnectionProviderType): Maybe<UserExternalConnectionEntry> {
  return connection?.e?.[providerType];
}

/**
 * Returns true if the entry is in the `connected` status.
 *
 * @param entry - The entry to check.
 * @returns True when the entry is connected.
 */
export function userExternalConnectionEntryIsConnected(entry: Maybe<UserExternalConnectionEntry>): boolean {
  return entry?.st === 'connected';
}

/**
 * Returns true if the entry declares an expiration that has already passed.
 *
 * @param entry - The entry to check.
 * @param now - The instant to compare against. Defaults to the current time.
 * @returns True when the entry's credentials are known to have expired.
 */
export function userExternalConnectionEntryIsExpired(entry: Maybe<UserExternalConnectionEntry>, now: Date = new Date()): boolean {
  return entry?.exa != null && entry.exa.getTime() <= now.getTime();
}

/**
 * Returns true if the user is currently connected to the given provider.
 *
 * @param connection - The loaded connection document.
 * @param providerType - The provider to check.
 * @returns True when the provider's entry is connected.
 */
export function userExternalConnectionIsConnectedToProvider(connection: Maybe<UserExternalConnection>, providerType: UserExternalConnectionProviderType): boolean {
  return userExternalConnectionEntryIsConnected(userExternalConnectionEntryForProvider(connection, providerType));
}
