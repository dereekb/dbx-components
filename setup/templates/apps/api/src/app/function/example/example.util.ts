import { ExampleDocument } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiNestContext } from '../function';

export function exampleForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ExampleDocument {
  const exampleFirestoreCollection = nest.APP_CODE_PREFIX_LOWERFirestoreCollections.exampleFirestoreCollection;
  const exampleDocument = exampleFirestoreCollection.documentAccessor().loadDocumentForPath(uid);
  return exampleDocument;
}
