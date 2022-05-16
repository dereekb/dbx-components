import { ProfileDocument } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiNestContext } from '../function';

export function profileForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.demoFirestoreCollections.profileFirestoreCollection;
  const profileDocument = profileFirestoreCollection.documentAccessor().loadDocumentForPath(uid);
  return profileDocument;
}
