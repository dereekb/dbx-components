import { type ExampleDocument } from 'FIREBASE_COMPONENTS_NAME';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type APP_CODE_PREFIXApiNestContext } from '../function';

export function exampleForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ExampleDocument {
  const exampleCollection = nest.APP_CODE_PREFIX_CAMELFirestoreCollections.exampleCollection;
  return exampleCollection.documentAccessor().loadDocumentForId(uid);
}
