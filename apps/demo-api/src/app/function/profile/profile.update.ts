import { ProfileDocument, UpdateProfileParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelfunction } from '../function';
import { profileForUserRequest } from './profile.util';

export const updateProfile: DemoUpdateModelfunction<UpdateProfileParams> = async (request) => {
  const { nest, auth, data } = request;
  const updateProfile = await nest.profileActions.updateProfile(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  await updateProfile(profileDocument);
};
