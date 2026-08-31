import { type FirebaseAuthUserId, type FirestoreModelKey, firestoreModelIdsFromKey, firestoreModelKeyCollectionName } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type GuestbookFirestoreCollections, guestbookIdentity } from './guestbook';
import { type GuestbookId } from './guestbook.id';

/**
 * @module guestbook.util
 *
 * "Has this user signed this guestbook?" — the one predicate every guestbook-scoped permission asks.
 *
 * It lives here, in the shared model package, because THREE layers ask it and they must not drift: the
 * model service's FormSpace ownership-key grant, the API's FormSpace upload-authorization delegate, and
 * the create path that decides who may open a guestbook's shared album. `firestore.rules` asks the same
 * question a fourth way, in its own language — see `authUserHasGuestbookEntryForOwnershipKey()`.
 */

/**
 * Input for {@link isGuestbookSignedByUser}.
 */
export interface IsGuestbookSignedByUserInput {
  readonly collections: GuestbookFirestoreCollections;
  readonly guestbookId: GuestbookId;
  readonly uid: FirebaseAuthUserId;
}

/**
 * Returns whether the user has left an entry on the guestbook.
 *
 * One existence check rather than a query: a GuestbookEntry's document id IS its author's uid, so the
 * membership test is a `get` on a path both this and `firestore.rules` can build from the same two values.
 *
 * @param input - The collections, the guestbook, and the user.
 * @returns True when the user has signed the guestbook.
 */
export async function isGuestbookSignedByUser(input: IsGuestbookSignedByUserInput): Promise<boolean> {
  const { collections, guestbookId, uid } = input;
  const guestbookDocument = collections.guestbookCollection.documentAccessor().loadDocumentForId(guestbookId);
  return collections.guestbookEntryCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(uid).exists();
}

/**
 * Input for {@link isGuestbookOwnershipKeySignedByUser}.
 */
export interface IsGuestbookOwnershipKeySignedByUserInput {
  readonly collections: GuestbookFirestoreCollections;
  /**
   * An ownership key that may or may not name a Guestbook.
   */
  readonly ownershipKey: Maybe<FirestoreModelKey>;
  readonly uid: Maybe<FirebaseAuthUserId>;
}

/**
 * Returns whether the ownership key names a Guestbook the user has signed.
 *
 * The shape check comes first and short-circuits, so a profile-owned model — the overwhelmingly common
 * case — costs no read at all.
 *
 * @param input - The collections, the candidate ownership key, and the user.
 * @returns True when the key names a guestbook and the user has signed it.
 */
export async function isGuestbookOwnershipKeySignedByUser(input: IsGuestbookOwnershipKeySignedByUserInput): Promise<boolean> {
  const { collections, ownershipKey, uid } = input;
  let signed = false;

  if (ownershipKey != null && uid != null && firestoreModelKeyCollectionName(ownershipKey) === guestbookIdentity.collectionName) {
    signed = await isGuestbookSignedByUser({ collections, guestbookId: firestoreModelIdsFromKey(ownershipKey)[0], uid });
  }

  return signed;
}
