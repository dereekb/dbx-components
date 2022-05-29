import { CollectionReference, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext, FirestoreCollectionWithParent, firestoreBoolean, DocumentDataWithId, AbstractFirestoreDocumentWithParent, optionalFirestoreDate, DocumentReference, FirestoreCollectionGroup, CollectionGroup } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

export interface GuestbookFirestoreCollections {
  guestbookFirestoreCollection: GuestbookFirestoreCollection;
  guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
}

// MARK: Guestbook
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

export type GuestbookWithId = DocumentDataWithId<Guestbook>;

export interface GuestbookRef extends DocumentReferenceRef<Guestbook> {}

export class GuestbookDocument extends AbstractFirestoreDocument<Guestbook, GuestbookDocument> {}

export const guestbookCollectionPath = 'guestbook';

export const guestbookConverter = snapshotConverterFunctions<Guestbook>({
  fields: {
    published: firestoreBoolean({ default: false }),
    name: firestoreString({ default: '' }),
    locked: firestoreBoolean({ default: false }),
    lockedAt: optionalFirestoreDate()
  }
});

export function guestbookCollectionReference(context: FirestoreContext): CollectionReference<Guestbook> {
  return context.collection(guestbookCollectionPath).withConverter<Guestbook>(guestbookConverter);
}

export type GuestbookFirestoreCollection = FirestoreCollection<Guestbook, GuestbookDocument>;

export function guestbookFirestoreCollection(firestoreContext: FirestoreContext): GuestbookFirestoreCollection {
  return firestoreContext.firestoreCollection({
    itemsPerPage: 50,
    collection: guestbookCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new GuestbookDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Guestbook Entry
export interface GuestbookEntry extends UserRelatedById {
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

export interface GuestbookEntryRef extends DocumentReferenceRef<GuestbookEntry> {}

export class GuestbookEntryDocument extends AbstractFirestoreDocumentWithParent<Guestbook, GuestbookEntry, GuestbookEntryDocument> {}

export const guestbookCollectionGuestbookEntryCollectionPath = 'entry';

export const guestbookEntryConverter = snapshotConverterFunctions<GuestbookEntry>({
  fields: {
    message: firestoreString({ default: '' }),
    signed: firestoreString({ default: '' }),
    updatedAt: firestoreDate({ saveDefaultAsNow: true }),
    createdAt: firestoreDate({ saveDefaultAsNow: true }),
    published: firestoreBoolean({ default: false, defaultBeforeSave: false })
  }
});

export function guestbookEntryCollectionReferenceFactory(context: FirestoreContext): (guestbook: GuestbookDocument) => CollectionReference<GuestbookEntry> {
  return (guestbook: GuestbookDocument) => {
    return context.subcollection(guestbook.documentRef, guestbookCollectionGuestbookEntryCollectionPath).withConverter<GuestbookEntry>(guestbookEntryConverter);
  };
}

export type GuestbookEntryFirestoreCollection = FirestoreCollectionWithParent<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument>;
export type GuestbookEntryFirestoreCollectionFactory = (parent: GuestbookDocument) => GuestbookEntryFirestoreCollection;

export function guestbookEntryFirestoreCollectionFactory(firestoreContext: FirestoreContext): GuestbookEntryFirestoreCollectionFactory {
  const factory = guestbookEntryCollectionReferenceFactory(firestoreContext);

  return (parent: GuestbookDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new GuestbookEntryDocument(parent.documentRef, accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

export function guestbookEntryCollectionReference(context: FirestoreContext): CollectionGroup<GuestbookEntry> {
  return context.collectionGroup(guestbookCollectionGuestbookEntryCollectionPath).withConverter<GuestbookEntry>(guestbookEntryConverter);
}

export type GuestbookEntryFirestoreCollectionGroup = FirestoreCollectionGroup<GuestbookEntry, GuestbookEntryDocument>;

export function guestbookEntryFirestoreCollectionGroup(firestoreContext: FirestoreContext): GuestbookEntryFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    itemsPerPage: 50,
    queryLike: guestbookEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new GuestbookEntryDocument(undefined, accessor, documentAccessor),
    firestoreContext
  });
}
