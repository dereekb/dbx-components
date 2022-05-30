import { FirestoreContext } from '@dereekb/firebase';
import { guestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, GuestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection, GuestbookFirestoreCollection, GuestbookFirestoreCollections, profileFirestoreCollection, ProfileFirestoreCollection, ProfileFirestoreCollections, profilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionFactory } from './models';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections, GuestbookFirestoreCollections {
  abstract readonly guestbookFirestoreCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileFirestoreCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    guestbookFirestoreCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileFirestoreCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext)
  };
}
