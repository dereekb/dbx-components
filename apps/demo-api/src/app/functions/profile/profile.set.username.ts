import { DemoFirestoreCollections, SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { onCallWithNestContext } from '../function';

export const profileSetUsername = onCallWithNestContext(async (nest, data: SetProfileUsernameParams, context) => {
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);


  if (data.targetProfile) {

  }

});
