import { FirestoreContext } from '@dereekb/firebase';
import { profileFirestoreCollection, ProfileFirestoreCollection, ProfileFirestoreCollections, profilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionFactory } from './profile/profile';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections {
  abstract readonly profileFirestoreCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    profileFirestoreCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext)
  };
}
