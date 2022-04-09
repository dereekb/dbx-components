import { profileSetUsername } from './profile.set.username';
import { SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { demoApiFunctionContextFactory } from '../../../test/fixture';

demoApiFunctionContextFactory((f) => {

  describe('profileSetUsername', () => {

    it('should set the profile username.', async () => {
      const fn = f.parent.instance.wrapCloudFunction(profileSetUsername(f.instance.nestGetter));

      const params: SetProfileUsernameParams = {
        username: 'username'
      };

      const result = await fn(params, { auth: { uid: 'hello' }}); // todo
      
    });

  });

});
