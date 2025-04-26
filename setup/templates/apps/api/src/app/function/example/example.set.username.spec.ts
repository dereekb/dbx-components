import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { APP_CODE_PREFIX_CAMELApiFunctionContextFactory, APP_CODE_PREFIX_CAMELAuthorizedUserContext } from './../../../test/fixture';
import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { exampleSetUsername } from './example.set.username';

it('should run a test', () => {
  expect(true).toBe(true);
});

APP_CODE_PREFIX_CAMELApiFunctionContextFactory((f) => {

  describeCallableRequestTest(exampleSetUsernameKey, { f, fn: exampleSetUsername }, (exampleSetUsernameCloudFn) => {

    APP_CODE_PREFIX_CAMELAuthorizedUserContext({ f }, (u) => {

      it('should run a test', () => {

        expect(u).toBeDefined();

      });

    });

  });

});
