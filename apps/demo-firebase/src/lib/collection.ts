import { FirestoreContext } from '@dereekb/firebase';
import { guestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionFactory, guestbookFirestoreCollection, GuestbookFirestoreCollection, GuestbookFirestoreCollections } from './guestbook';
import { profileFirestoreCollection, ProfileFirestoreCollection, ProfileFirestoreCollections, profilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionFactory } from './profile/profile';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections, GuestbookFirestoreCollections {
  abstract readonly guestbookFirestoreCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileFirestoreCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    guestbookFirestoreCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileFirestoreCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext)
  };
}
