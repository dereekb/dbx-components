import { CollectionReference, AbstractFirestoreDocument, makeSnapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext, FirestoreCollectionWithParent, firestoreBoolean, DocumentDataWithId, AbstractFirestoreDocumentWithParent } from "@dereekb/firebase";

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
  active: boolean;
  /**
   * Guestbook name
   */
  name: string;
  /**
   * Whether or not this guestbook and it's entries can still be edited.
   */
  locked?: boolean;
  /**
   * Date the guestbook was locked at.
   */
  lockedAt?: Date;
}

export type GuestbookWithId = DocumentDataWithId<Guestbook>;

export interface GuestbookRef extends DocumentReferenceRef<Guestbook> { }

export class GuestbookDocument extends AbstractFirestoreDocument<Guestbook, GuestbookDocument> { }

export const guestbookCollectionPath = 'guestbook';

export const guestbookConverter = makeSnapshotConverterFunctions<Guestbook>({
  fields: {
    active: firestoreBoolean(),
    name: firestoreString(),
    locked: firestoreBoolean({ default: false }),
    lockedAt: firestoreDate()
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
   * Whether or not the entry has been published. This cannot be changed once published.
   */
  published?: boolean;
}

export interface GuestbookEntryRef extends DocumentReferenceRef<GuestbookEntry> { }

export class GuestbookEntryDocument extends AbstractFirestoreDocumentWithParent<Guestbook, GuestbookEntry, GuestbookEntryDocument> { }

export const guestbookEntryCollectionPath = 'guestbookEntry';

export const guestbookEntryConverter = makeSnapshotConverterFunctions<GuestbookEntry>({
  fields: {
    message: firestoreString(),
    signed: firestoreString(),
    updatedAt: firestoreDate(),
    createdAt: firestoreDate({ saveDefaultAsNow: true }),
    published: firestoreBoolean({ defaultBeforeSave: false })
  }
});

export function guestbookEntryCollectionReferenceFactory(context: FirestoreContext): (guestbook: GuestbookDocument) => CollectionReference<GuestbookEntry> {
  return (guestbook: GuestbookDocument) => {
    return context.subcollection(guestbook.documentRef, guestbookEntryCollectionPath).withConverter<GuestbookEntry>(guestbookEntryConverter);
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
  }
}
