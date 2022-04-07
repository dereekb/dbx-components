import { ProfileDocument, profileWithUid, SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { onCallWithNestContext } from '../function';

export const profileSetUsername = onCallWithNestContext(async (nest, data: SetProfileUsernameParams, context) => {
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);
  const params = setProfileUsername.object;

  let profileDocument: ProfileDocument;

  if (params.profile) {
    profileDocument = await nest.demoFirestoreCollections.profileFirestoreCollection.documentAccessor().loadDocumentForPath(params.profile);
  } else {
    // todo: profiles should have the same id as their user's uid to make it easy to find.
    profileDocument = await nest.demoFirestoreCollections.profileFirestoreCollection.query(profileWithUid(context.auth?.uid!)).query();
    // get the profile for the current user.
  }
});
