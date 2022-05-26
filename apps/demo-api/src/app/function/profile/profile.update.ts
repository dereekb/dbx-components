import { ProfileDocument, UpdateProfileParams } from '@dereekb/demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { profileForUser } from './profile.util';

export const updateProfile = onCallWithDemoNestContext(
  inAuthContext(async (nest, data: UpdateProfileParams, context) => {
    const updateProfile = await nest.profileActions.updateProfile(data);

    const uid = updateProfile.params.uid ?? context.auth.uid;

    const profileDocument: ProfileDocument = profileForUser(nest, uid);
    await updateProfile(profileDocument);
  })
);
