import { ProfileDocument } from '@dereekb/demo-firebase';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { DemoApiNestContext } from '../function';

export function profileForUser(nest: DemoApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.demoFirestoreCollections.profileCollection;
  const profileDocument = profileFirestoreCollection.documentAccessor().loadDocumentForPath(uid);
  return profileDocument;
}
