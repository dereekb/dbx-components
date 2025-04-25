import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { APP_CODE_PREFIX_LOWERApiFunctionContextFactory, APP_CODE_PREFIX_LOWERAuthorizedUserContext } from './../../../test/fixture';
import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { exampleSetUsername } from './example.set.username';

it('should run a test', () => {
  expect(true).toBe(true);
});

APP_CODE_PREFIX_LOWERApiFunctionContextFactory((f) => {

  describeCloudFunctionTest(exampleSetUsernameKey, { f, fn: exampleSetUsername }, (exampleSetUsernameCloudFn) => {

    APP_CODE_PREFIX_LOWERAuthorizedUserContext({ f }, (u) => {

      it('should run a test', () => {

        expect(u).toBeDefined();

      });

    });

  });

});
