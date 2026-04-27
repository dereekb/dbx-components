import {
  type CollectionReference,
  AbstractFirestoreDocument,
  snapshotConverterFunctions,
  firestoreString,
  firestoreDate,
  type FirestoreCollection,
  type UserRelatedById,
  type FirestoreContext,
  type FirestoreCollectionWithParent,
  firestoreBoolean,
  AbstractFirestoreDocumentWithParent,
  optionalFirestoreDate,
  type FirestoreCollectionGroup,
  type CollectionGroup,
  firestoreModelIdentity,
  type UserRelated,
  copyUserRelatedDataAccessorFactoryFunction,
  firestoreUID,
  firestoreNumber,
  optionalFirestoreString
} from '@dereekb/firebase';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type ProfileId } from '../profile/profile.id';

/**
 * Aggregates the Firestore collections for the Guestbook model group.
 *
 * @dbxModelGroup Guestbook
 */
export interface GuestbookFirestoreCollections {
  guestbookCollection: GuestbookFirestoreCollection;
  guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
}

export type GuestbookTypes = typeof guestbookIdentity | typeof guestbookEntryIdentity;

// MARK: Guestbook
export const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');

/**
 * A guestbook record that owns a list of {@link GuestbookEntry} signatures.
 *
 * @dbxModel
 */
export interface Guestbook {
  /**
   * Whether or not this guestbook should show up in the list.
   *
   * If not active, this item is still considered locked.
   *
   * @dbxModelVariable published
   */
  published: boolean;
  /**
   * Guestbook name.
   *
   * @dbxModelVariable name
   */
  name: string;
  /**
   * Whether or not this guestbook and it's entries can still be edited.
   *
   * @dbxModelVariable locked
   */
  locked: boolean;
  /**
   * Date the guestbook was locked at.
   *
   * @dbxModelVariable lockedAt
   */
  lockedAt?: Maybe<Date>;
  /**
   * User who created the guestbook.
   *
   * @dbxModelVariable createdBy
   */
  cby?: Maybe<ProfileId>;
}

export type GuestbookRoles = 'admin' | 'subscribeToNotifications' | GrantedReadRole;

export class GuestbookDocument extends AbstractFirestoreDocument<Guestbook, GuestbookDocument, typeof guestbookIdentity> {
  get modelIdentity() {
    return guestbookIdentity;
  }
}

export const guestbookConverter = snapshotConverterFunctions<Guestbook>({
  fields: {
    published: firestoreBoolean({ default: false }),
    name: firestoreString({ default: '' }),
    locked: firestoreBoolean({ default: false }),
    lockedAt: optionalFirestoreDate(),
    cby: optionalFirestoreString()
  }
});

/**
 * Returns the root Firestore collection reference for Guestbook documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the guestbook collection.
 */
export function guestbookCollectionReference(context: FirestoreContext): CollectionReference<Guestbook> {
  return context.collection(guestbookIdentity.collectionName);
}

export type GuestbookFirestoreCollection = FirestoreCollection<Guestbook, GuestbookDocument>;

/**
 * Creates the Firestore collection accessor for Guestbook documents,
 * wiring the converter, model identity, and document factory together.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns A GuestbookFirestoreCollection for querying and accessing guestbook documents.
 */
export function guestbookFirestoreCollection(firestoreContext: FirestoreContext): GuestbookFirestoreCollection {
  return firestoreContext.firestoreCollection({
    converter: guestbookConverter,
    modelIdentity: guestbookIdentity,
    collection: guestbookCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new GuestbookDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Guestbook Entry
export const guestbookEntryIdentity = firestoreModelIdentity(guestbookIdentity, 'guestbookEntry', 'gbe');

/**
 * A signed entry in a {@link Guestbook}.
 *
 * @dbxModel
 */
export interface GuestbookEntry extends UserRelated, UserRelatedById {
  /**
   * Guestbook message.
   *
   * @dbxModelVariable message
   */
  message: string;
  /**
   * Arbitrary string for signature.
   *
   * @dbxModelVariable signed
   */
  signed: string;
  /**
   * Date the entry was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  updatedAt: Date;
  /**
   * Date the entry was originally created at.
   *
   * @dbxModelVariable createdAt
   */
  createdAt: Date;
  /**
   * Whether or not the entry has been published. It can be unpublished at any time by the user.
   *
   * @dbxModelVariable published
   */
  published: boolean;
  /**
   * The number of likes the entry has recieved from users.
   *
   * Uniqueness of likes is not retained, so users may like something more than once.
   *
   * @dbxModelVariable likes
   */
  likes: number;
}

export type GuestbookEntryRoles = 'like' | GrantedReadRole | GrantedUpdateRole;

export class GuestbookEntryDocument extends AbstractFirestoreDocumentWithParent<Guestbook, GuestbookEntry, GuestbookEntryDocument, typeof guestbookEntryIdentity> {
  get modelIdentity() {
    return guestbookEntryIdentity;
  }
}

export const guestbookEntryConverter = snapshotConverterFunctions<GuestbookEntry>({
  fields: {
    uid: firestoreUID(),
    message: firestoreString(),
    signed: firestoreString(),
    updatedAt: firestoreDate({ saveDefaultAsNow: true }),
    createdAt: firestoreDate({ saveDefaultAsNow: true }),
    published: firestoreBoolean({ default: false, defaultBeforeSave: false }),
    likes: firestoreNumber({ default: 0 })
  }
});

/**
 * Creates a factory function that returns the subcollection reference for
 * GuestbookEntry documents under a given Guestbook parent document.
 *
 * @param context - The FirestoreContext used to resolve the subcollection.
 * @returns A function that accepts a GuestbookDocument and returns its GuestbookEntry subcollection reference.
 */
export function guestbookEntryCollectionReferenceFactory(context: FirestoreContext): (guestbook: GuestbookDocument) => CollectionReference<GuestbookEntry> {
  return (guestbook: GuestbookDocument) => {
    return context.subcollection(guestbook.documentRef, guestbookEntryIdentity.collectionName);
  };
}

export const guestbookEntryAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<GuestbookEntry>();

export type GuestbookEntryFirestoreCollection = FirestoreCollectionWithParent<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument>;
export type GuestbookEntryFirestoreCollectionFactory = (parent: GuestbookDocument) => GuestbookEntryFirestoreCollection;

/**
 * Creates a factory that produces GuestbookEntry Firestore collection accessors
 * scoped to a specific parent Guestbook document.
 *
 * @param firestoreContext - The FirestoreContext used to build the subcollection.
 * @returns A factory function that accepts a GuestbookDocument parent and returns its GuestbookEntry collection.
 */
export function guestbookEntryFirestoreCollectionFactory(firestoreContext: FirestoreContext): GuestbookEntryFirestoreCollectionFactory {
  const factory = guestbookEntryCollectionReferenceFactory(firestoreContext);

  return (parent: GuestbookDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      converter: guestbookEntryConverter,
      modelIdentity: guestbookEntryIdentity,
      collection: factory(parent),
      accessorFactory: guestbookEntryAccessorFactory,
      makeDocument: (accessor, documentAccessor) => new GuestbookEntryDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

/**
 * Returns the collection group reference for all GuestbookEntry documents
 * across every parent Guestbook, enabling cross-guestbook queries.
 *
 * @param context - The FirestoreContext used to resolve the collection group.
 * @returns A CollectionGroup reference for GuestbookEntry documents.
 */
export function guestbookEntryCollectionReference(context: FirestoreContext): CollectionGroup<GuestbookEntry> {
  return context.collectionGroup(guestbookEntryIdentity.collectionName);
}

export type GuestbookEntryFirestoreCollectionGroup = FirestoreCollectionGroup<GuestbookEntry, GuestbookEntryDocument>;

/**
 * Creates the Firestore collection group accessor for GuestbookEntry documents,
 * allowing queries across all guestbook entry subcollections.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection group.
 * @returns A GuestbookEntryFirestoreCollectionGroup for cross-parent guestbook entry queries.
 */
export function guestbookEntryFirestoreCollectionGroup(firestoreContext: FirestoreContext): GuestbookEntryFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    converter: guestbookEntryConverter,
    modelIdentity: guestbookEntryIdentity,
    accessorFactory: guestbookEntryAccessorFactory,
    queryLike: guestbookEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new GuestbookEntryDocument(accessor, documentAccessor),
    firestoreContext
  });
}
