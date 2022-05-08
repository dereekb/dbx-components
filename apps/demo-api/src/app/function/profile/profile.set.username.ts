import { ProfileDocument, SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { userHasNoProfileError } from '../../common/model/profile/profile.error';


export const profileSetUsername = onCallWithDemoNestContext(inAuthContext(async (nest, data: SetProfileUsernameParams, context) => {
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);

  const profileFirestoreCollection = nest.demoFirestoreCollections.profileFirestoreCollection;
  const params = setProfileUsername.params;

  let profileDocument: ProfileDocument;
  const uid = params.uid ?? context.auth?.uid!;

  profileDocument = await profileFirestoreCollection.documentAccessor().loadDocumentForPath(uid);
  const exists = await profileDocument.accessor.exists();

  if (!exists) {
    throw userHasNoProfileError(uid);
  }

  await setProfileUsername(profileDocument);
  return { success: true };
}));
