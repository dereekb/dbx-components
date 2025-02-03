import { CollectionReference, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, FirestoreContext, FirestoreCollectionWithParent, firestoreBoolean, DocumentDataWithIdAndKey, AbstractFirestoreDocumentWithParent, optionalFirestoreDate, FirestoreCollectionGroup, CollectionGroup, firestoreModelIdentity, UserRelated, copyUserRelatedDataAccessorFactoryFunction, firestoreUID } from '@dereekb/firebase';
import { GrantedReadRole } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';

export interface GuestbookFirestoreCollections {
  guestbookCollection: GuestbookFirestoreCollection;
  guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
}

export type GuestbookTypes = typeof guestbookIdentity | typeof guestbookEntryIdentity;

// MARK: Guestbook
export const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');

export interface Guestbook {
  /**
   * Whether or not this guestbook should show up in the list.
   *
   * If not active, this item is still considered locked.
   */
  published: boolean;
  /**
   * Guestbook name
   */
  name: string;
  /**
   * Whether or not this guestbook and it's entries can still be edited.
   */
  locked: boolean;
  /**
   * Date the guestbook was locked at.
   */
  lockedAt?: Maybe<Date>;
}

export type GuestbookRoles = 'admin' | GrantedReadRole;

export type GuestbookWithId = DocumentDataWithIdAndKey<Guestbook>;

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
    lockedAt: optionalFirestoreDate()
  }
});

export function guestbookCollectionReference(context: FirestoreContext): CollectionReference<Guestbook> {
  return context.collection(guestbookIdentity.collectionName);
}

export type GuestbookFirestoreCollection = FirestoreCollection<Guestbook, GuestbookDocument>;

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

export interface GuestbookEntry extends UserRelated, UserRelatedById {
  /**
   * Guestbook message.
   */
  message: string;
  /**
   * Arbitrary string for signature
   */
  signed: string;
  /**
   * Date the entry was last updated at.
   */
  updatedAt: Date;
  /**
   * Date the entry was originally created at.
   */
  createdAt: Date;
  /**
   * Whether or not the entry has been published. It can be unpublished at any time by the user.
   */
  published: boolean;
}

export type GuestbookEntryRoles = 'owner' | GrantedReadRole;

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
    published: firestoreBoolean({ default: false, defaultBeforeSave: false })
  }
});

export function guestbookEntryCollectionReferenceFactory(context: FirestoreContext): (guestbook: GuestbookDocument) => CollectionReference<GuestbookEntry> {
  return (guestbook: GuestbookDocument) => {
    return context.subcollection(guestbook.documentRef, guestbookEntryIdentity.collectionName);
  };
}

export const guestbookEntryAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<GuestbookEntry>();

export type GuestbookEntryFirestoreCollection = FirestoreCollectionWithParent<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument>;
export type GuestbookEntryFirestoreCollectionFactory = (parent: GuestbookDocument) => GuestbookEntryFirestoreCollection;

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

export function guestbookEntryCollectionReference(context: FirestoreContext): CollectionGroup<GuestbookEntry> {
  return context.collectionGroup(guestbookEntryIdentity.collectionName);
}

export type GuestbookEntryFirestoreCollectionGroup = FirestoreCollectionGroup<GuestbookEntry, GuestbookEntryDocument>;

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
