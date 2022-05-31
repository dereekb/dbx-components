import { FirestoreContext } from '@dereekb/firebase';
import { guestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, GuestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection, GuestbookFirestoreCollection, GuestbookFirestoreCollections, profileFirestoreCollection, ProfileFirestoreCollection, ProfileFirestoreCollections, profilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionFactory } from './models';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections, GuestbookFirestoreCollections {
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    guestbookCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext)
  };
}
