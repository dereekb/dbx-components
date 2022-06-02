import { ProfileDocument, UpdateProfileParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelfunction } from '../function';
import { profileForUser } from './profile.util';

export const updateProfile: DemoUpdateModelfunction<UpdateProfileParams> = async (nest, data, context) => {
  const updateProfile = await nest.profileActions.updateProfile(data);

  const uid = updateProfile.params.uid ?? context.auth.uid;
  const profileDocument: ProfileDocument = profileForUser(nest, uid);

  await updateProfile(profileDocument);
};
