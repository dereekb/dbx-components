import { FirestoreContext } from '@dereekb/firebase';
import { profileFirestoreCollection, ProfileFirestoreCollection } from './profile/profile';

export abstract class DemoFirestoreCollections {
  abstract readonly profile: ProfileFirestoreCollection;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    profile: profileFirestoreCollection(firestoreContext)
  };
}
