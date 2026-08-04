import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type FirebaseAuthUserIdRef, type UserExternalConnectionEntry, type UserExternalConnectionFirestoreCollections, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type UserExternalConnectionCredentials, type UserExternalConnectionServerFirestoreCollections } from './userexternalconnection.private';

/**
 * Context required by {@link userExternalConnectionAccessor}.
 *
 * Carries both halves of the pair, the same as the server actions context. Unlike that context there
 * is no `FirestoreContextReference` here: every read is a plain document read, so nothing in this
 * file needs to start a transaction.
 */
export interface UserExternalConnectionAccessorContext extends UserExternalConnectionFirestoreCollections, UserExternalConnectionServerFirestoreCollections {}

/**
 * Identifies the one provider entry a read is about.
 */
export interface UserExternalConnectionReadParams {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
}

/**
 * Both halves of a user's connection state for a single provider.
 *
 * The public entry and the private credentials are returned together because a caller deciding
 * whether it can act as this user needs both: the credentials alone cannot say whether the
 * connection is `connected` or `error`, and the entry alone cannot be used to call anything.
 *
 * Either side may be null. A user with no connection document at all reads as both null.
 */
export interface UserExternalConnectionForProvider {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The provider's entry on the client-readable document, when the user has one.
   */
  readonly entry: Maybe<UserExternalConnectionEntry>;
  /**
   * The provider's stored credentials in plaintext, when the user has any.
   */
  readonly credentials: Maybe<UserExternalConnectionCredentials>;
}

/**
 * Input identifying the user a {@link UserExternalConnectionAccessorUserInstance} reads for.
 */
export interface UserExternalConnectionAccessorUserInput extends FirebaseAuthUserIdRef {}

/**
 * A {@link UserExternalConnectionAccessor} narrowed to ONE user and ONE provider.
 *
 * The accessor's entire read surface with `{ uid, providerType }` already applied.
 */
export interface UserExternalConnectionAccessorProviderInstance {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Loads both halves of the pair.
   */
  readUserExternalConnectionForProvider(): Promise<UserExternalConnectionForProvider>;
  /**
   * Loads only the stored credentials.
   */
  readUserExternalConnectionCredentials(): Promise<Maybe<UserExternalConnectionCredentials>>;
}

/**
 * A {@link UserExternalConnectionAccessor} narrowed to one user, awaiting the provider to target.
 */
export type UserExternalConnectionAccessorUserInstance = FactoryWithRequiredInput<UserExternalConnectionAccessorProviderInstance, UserExternalConnectionProviderType>;

/**
 * Server-only read surface for the UserExternalConnection document pair.
 *
 * Deliberately the whole read surface and nothing more: no expiration policy, no refresh, no
 * assertions. That keeps this usable by the OAuth provider services themselves — they need to read
 * the credentials they are about to replace, and a tier that could refresh would have to know about
 * the provider registry those services are registered in.
 *
 * {@link UserExternalConnectionReader} wraps this and adds the policy.
 */
export abstract class UserExternalConnectionAccessor {
  /**
   * Narrows this accessor to one user, returning a factory that narrows it further to one provider.
   *
   * The accessor's only entry point, and the same two levels
   * {@link UserExternalConnectionReader.readerForUser} has, so a caller holding either states the user
   * and provider it is reading for once:
   *
   * ```ts
   * const credentials = await accessor.accessorForUser({ uid })(CALCOM).readUserExternalConnectionCredentials();
   * ```
   *
   * @param input - The user to read for.
   * @returns A factory producing an accessor for whichever of that user's providers is needed.
   */
  abstract accessorForUser(input: UserExternalConnectionAccessorUserInput): UserExternalConnectionAccessorUserInstance;
}

/**
 * Reference to a {@link UserExternalConnectionAccessor} instance.
 */
export interface UserExternalConnectionAccessorRef {
  readonly userExternalConnectionAccessor: UserExternalConnectionAccessor;
}

/**
 * Creates a {@link UserExternalConnectionAccessor} bound to the given context.
 *
 * Reads are NOT paired the way writes are. The pairing is a write invariant — the two documents are
 * only ever written together, so a read of one cannot observe a state the other contradicts, and
 * reading them in a transaction would buy nothing. Server paths load both halves; the client can only
 * ever load the public one.
 *
 * @param context - The context carrying both halves of the pair.
 * @returns A concrete UserExternalConnectionAccessor implementation.
 */
export function userExternalConnectionAccessor(context: UserExternalConnectionAccessorContext): UserExternalConnectionAccessor {
  const { userExternalConnectionCollection, userExternalConnectionPrivateCollection } = context;

  async function readUserExternalConnectionCredentials(params: UserExternalConnectionReadParams): Promise<Maybe<UserExternalConnectionCredentials>> {
    const { uid, providerType } = params;
    const document = userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(uid);
    const data = await document.snapshotData();
    return data?.cr?.[providerType];
  }

  async function readUserExternalConnectionForProvider(params: UserExternalConnectionReadParams): Promise<UserExternalConnectionForProvider> {
    const { uid, providerType } = params;
    const publicDocument = userExternalConnectionCollection.documentAccessor().loadDocumentForId(uid);
    const privateDocument = userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(uid);

    const [publicData, privateData] = await Promise.all([publicDocument.snapshotData(), privateDocument.snapshotData()]);

    return {
      uid,
      providerType,
      entry: publicData?.e?.[providerType],
      credentials: privateData?.cr?.[providerType]
    };
  }

  function accessorForUser(input: UserExternalConnectionAccessorUserInput): UserExternalConnectionAccessorUserInstance {
    const { uid } = input;

    return (providerType) => {
      const params: UserExternalConnectionReadParams = { uid, providerType };

      return {
        uid,
        providerType,
        readUserExternalConnectionForProvider: () => readUserExternalConnectionForProvider(params),
        readUserExternalConnectionCredentials: () => readUserExternalConnectionCredentials(params)
      };
    };
  }

  return { accessorForUser };
}
