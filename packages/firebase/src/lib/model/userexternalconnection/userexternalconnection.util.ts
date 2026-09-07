import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common';
import { type UserExternalConnection, type UserExternalConnectionEntry, type UserExternalConnectionEntryMap, type UserExternalConnectionEntryStatus, type UserExternalConnectionErrorCode, type UserExternalConnectionLogin, type UserExternalConnectionLoginMap } from './userexternalconnection';
import { userExternalConnectionExternalAccountKey, type UserExternalConnectionCapability, type UserExternalConnectionExternalAccountId, type UserExternalConnectionExternalAccountKey, type UserExternalConnectionProviderType } from './userexternalconnection.id';

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
 * Input for {@link userExternalConnectionExternalAccountKeys}.
 *
 * BOTH maps, always. Taking them as one object rather than as a positional entry map is deliberate:
 * `ec` is the union of the two, and a signature that made either one omittable would make it possible
 * to recompute the array from half its sources — which silently drops the other half's keys out of the
 * lookup a sign-in performs.
 */
export interface UserExternalConnectionExternalAccountKeysInput {
  readonly entries?: Maybe<UserExternalConnectionEntryMap>;
  readonly logins?: Maybe<UserExternalConnectionLoginMap>;
}

/**
 * The SOLE producer of a {@link UserExternalConnection}'s `ec` array.
 *
 * Membership is every ENTRY carrying an `ea`, at ANY status, UNION every LOGIN LINK's `ea` —
 * deliberately unlike {@link userExternalConnectionConnectedProviderTypes}, which is `connected`-only.
 * `c` answers "whose credentials can I use?", a question about the credentials; `ec` answers "who IS
 * this account?", a question about identity, which survives an expired token. Filtering it by status
 * would make a returning user with `error` credentials look like a stranger, and a sign-in would
 * mint them a second Firebase user.
 *
 * The union is what makes the two lifecycles independent. Disconnecting a data connection removes its
 * entry, and if `ec` came from `e` alone that would take the sign-in binding with it — the next
 * sign-in would find no match and mint a second Firebase user for the same person.
 *
 * @param input - The entry map and the login map to derive from.
 * @returns The external account keys, deduped and sorted for a stable stored value.
 */
export function userExternalConnectionExternalAccountKeys(input: UserExternalConnectionExternalAccountKeysInput): UserExternalConnectionExternalAccountKey[] {
  const { entries, logins } = input;
  const keys = new Set<UserExternalConnectionExternalAccountKey>();

  if (entries) {
    Object.keys(entries).forEach((providerType) => {
      const externalAccountId = entries[providerType]?.ea;

      if (externalAccountId != null) {
        keys.add(userExternalConnectionExternalAccountKey({ providerType, externalAccountId }));
      }
    });
  }

  if (logins) {
    Object.keys(logins).forEach((providerType) => {
      const externalAccountId = logins[providerType]?.ea;

      if (externalAccountId != null) {
        keys.add(userExternalConnectionExternalAccountKey({ providerType, externalAccountId }));
      }
    });
  }

  const result = Array.from(keys);
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
 * Input for {@link userExternalConnectionValue}.
 */
export interface UserExternalConnectionValueInput {
  readonly uid: FirebaseAuthUserId;
  readonly entries: UserExternalConnectionEntryMap;
  readonly logins: UserExternalConnectionLoginMap;
  readonly now: Date;
}

/**
 * Assembles the COMPLETE document value from both maps.
 *
 * Extracted so the two appliers cannot diverge on how the derived arrays are produced: `ec` is the
 * union of `e` and `li`, and either applier computing it from only the map it happened to change
 * would drop the other map's keys out of the sign-in lookup.
 *
 * Exported for the one caller that legitimately replaces a whole map rather than one provider's key —
 * the login backfill. Ordinary writes go through the two appliers.
 *
 * @param input - The uid, both maps, and the instant to stamp.
 * @returns The next UserExternalConnection value to write.
 */
export function userExternalConnectionValue(input: UserExternalConnectionValueInput): UserExternalConnection {
  const { uid, entries, logins, now } = input;

  return {
    uid,
    e: entries,
    li: logins,
    c: userExternalConnectionConnectedProviderTypes(entries),
    ec: userExternalConnectionExternalAccountKeys({ entries, logins }),
    uat: now
  };
}

/**
 * Applies a single provider's entry and returns the COMPLETE next document.
 *
 * Returning the whole value (rather than a patch) is what keeps `c` honest: this is the only
 * exported way to change `e`, and it always recomputes `c` from the resulting map. There is no
 * exported path that touches one without the other.
 *
 * The login map is carried through UNCHANGED. A data connection's lifecycle says nothing about
 * whether the provider is still a way to sign in, so a disconnect must not remove the link.
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

  return userExternalConnectionValue({ uid, entries, logins: { ...current?.li }, now });
}

/**
 * Input for {@link applyUserExternalConnectionLogin}.
 */
export interface ApplyUserExternalConnectionLoginInput {
  /**
   * The currently stored document, when one exists.
   */
  readonly current?: Maybe<UserExternalConnection>;
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The next login link for this provider, or null to remove the provider's key entirely.
   */
  readonly login: Maybe<UserExternalConnectionLogin>;
  readonly now: Date;
}

/**
 * Applies a single provider's LOGIN LINK and returns the COMPLETE next document.
 *
 * The mirror of {@link applyUserExternalConnectionEntry}, and the only exported way to change `li`.
 * The entry map is carried through unchanged: linking a provider as a login method grants nothing
 * about its data connection, because the identity scopes and the data scopes are not guaranteed to
 * be the same set.
 *
 * @param input - The current document plus the login link to apply.
 * @returns The next UserExternalConnection value to write.
 */
export function applyUserExternalConnectionLogin(input: ApplyUserExternalConnectionLoginInput): UserExternalConnection {
  const { current, uid, providerType, login, now } = input;
  const logins: UserExternalConnectionLoginMap = { ...current?.li };

  if (login) {
    logins[providerType] = login;
  } else {
    delete logins[providerType];
  }

  return userExternalConnectionValue({ uid, entries: { ...current?.e }, logins, now });
}

/**
 * The identity facts a {@link UserExternalConnectionLogin} is derived from.
 *
 * Structurally the subset of `UserExternalConnectionSignInIdentity` (in
 * `@dereekb/firebase-server/model`) that a link records. Declared here rather than imported because
 * this package is shared with the browser and cannot name a server type — and because the derivation
 * genuinely needs nothing more than these four values.
 */
export interface UserExternalConnectionLoginIdentity {
  readonly externalAccountId: UserExternalConnectionExternalAccountId;
  readonly email?: Maybe<EmailAddress>;
  readonly emailVerified?: Maybe<boolean>;
  readonly label?: Maybe<string>;
}

/**
 * Input for {@link userExternalConnectionLoginForIdentity}.
 */
export interface UserExternalConnectionLoginForIdentityInput {
  readonly identity: UserExternalConnectionLoginIdentity;
  /**
   * The link currently stored for this provider, when there is one.
   */
  readonly previous?: Maybe<UserExternalConnectionLogin>;
  readonly now: Date;
}

/**
 * Derives the {@link UserExternalConnectionLogin} for an identity a link round trip resolved.
 *
 * `lat` survives a relink, the mirror of how {@link userExternalConnectionEntryForOutcome} preserves
 * `coa`: relinking the same provider is a re-consent, not a new relationship, so the date the account
 * first became a login method stays what it was.
 *
 * @param input - The resolved identity, the stored link, and the instant to stamp.
 * @returns The next login link.
 */
export function userExternalConnectionLoginForIdentity(input: UserExternalConnectionLoginForIdentityInput): UserExternalConnectionLogin {
  const { identity, previous, now } = input;

  return {
    ea: identity.externalAccountId,
    l: identity.label ?? previous?.l,
    em: identity.email ?? previous?.em,
    emv: identity.emailVerified ?? previous?.emv,
    lat: previous?.lat ?? now,
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
    li: {},
    c: [],
    ec: [],
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

/**
 * Returns the login link for the given provider, if any.
 *
 * @param connection - The loaded connection document.
 * @param providerType - The provider to read.
 * @returns The provider's login link, or null when the provider is not a login method for this user.
 */
export function userExternalConnectionLoginForProvider(connection: Maybe<UserExternalConnection>, providerType: UserExternalConnectionProviderType): Maybe<UserExternalConnectionLogin> {
  return connection?.li?.[providerType];
}

/**
 * Returns every provider type that is a login method for this user.
 *
 * @param connection - The loaded connection document.
 * @returns The linked provider types, sorted for a stable render order.
 */
export function userExternalConnectionLinkedLoginProviderTypes(connection: Maybe<UserExternalConnection>): UserExternalConnectionProviderType[] {
  const result = connection?.li ? Object.keys(connection.li) : [];
  result.sort();
  return result;
}
