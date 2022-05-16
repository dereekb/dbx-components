import { FirestoreContext } from '@dereekb/firebase';
import { exampleFirestoreCollection, ExampleFirestoreCollection, ExampleFirestoreCollections } from './example/example';

export abstract class APP_CODE_PREFIXFirestoreCollections implements ExampleFirestoreCollections {
  abstract readonly exampleFirestoreCollection: ExampleFirestoreCollection;
}

export function makeAPP_CODE_PREFIXFirestoreCollections(firestoreContext: FirestoreContext): APP_CODE_PREFIXFirestoreCollections {
  return {
    exampleFirestoreCollection: exampleFirestoreCollection(firestoreContext)
  };
}
