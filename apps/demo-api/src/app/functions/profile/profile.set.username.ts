import { ProfileDocument, profileWithUid, SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { onCallWithDemoNestContext } from '../function';

export const profileSetUsername = onCallWithDemoNestContext(async (nest, data: SetProfileUsernameParams, context) => {
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);

  const profileFirestoreCollection = nest.demoFirestoreCollections.profileFirestoreCollection;
  const params = setProfileUsername.params;

  let profileDocument: ProfileDocument;

  if (params.profile) {
    profileDocument = await profileFirestoreCollection.documentAccessor().loadDocumentForPath(params.profile);
  } else {
    profileDocument = (await profileFirestoreCollection.queryDocument(profileWithUid(context.auth?.uid!)).getFirstDoc())!;
  }

  await setProfileUsername(profileDocument);
  return { success: true };
});
