import { ExampleDocument } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiNestContext } from '../function';

export function exampleForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ExampleDocument {
  const exampleCollection = nest.APP_CODE_PREFIXFirestoreCollections.exampleCollection;
  const exampleDocument = exampleCollection.documentAccessor().loadDocumentForId(uid);
  return exampleDocument;
}
