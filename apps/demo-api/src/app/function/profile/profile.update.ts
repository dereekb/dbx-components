import { ProfileDocument, UpdateProfileParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelfunction } from '../function';
import { profileForUser } from './profile.util';

export const updateProfile: DemoUpdateModelfunction<UpdateProfileParams> = async (nest, data, context) => {
  const updateProfile = await nest.profileActions.updateProfile(data);

  const uid = context.auth.uid;
  let profileDocument: ProfileDocument;

  if (updateProfile.params.key != null) {
    profileDocument = await nest.useModel('profile', {
      context,
      key: updateProfile.params.key,
      roles: 'read',
      use: (x) => x.document
    });

    // Alternative way using model() chain
    /*
    profileDocument = await nest.model(context)('profile')(updateProfile.params.key)('read')((x) => {
      return x.document;
    });
    */
  } else {
    profileDocument = profileForUser(nest, uid);
  }

  await updateProfile(profileDocument);
};
