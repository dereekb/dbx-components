import { Firestore } from 'firebase/firestore';
import { profileFirestoreCollection, ProfileFirestoreCollection } from './profile/profile';

export abstract class DemoFirestoreCollections {
  abstract readonly profile: ProfileFirestoreCollection;
}

export function makeDemoFirestoreCollections(firestore: Firestore): DemoFirestoreCollections {
  return {
    profile: profileFirestoreCollection(firestore)
  };
}
