import { INestApplicationContext, Injectable, Module } from '@nestjs/common';
import { initFirebaseServerAdminTestEnvironment, firebaseAdminFunctionNestContextFactory } from '@dereekb/firebase-server/test';
import { onCallHandlerWithNestApplicationFactory } from './call';
import { MakeNestContext, NestApplicationFunctionFactory } from '../../nest.provider';
import { OnCallWithNestApplication } from '../call';

@Injectable()
export class TestInjectable {}

@Module({
  providers: [
    {
      provide: TestInjectable,
      useFactory: () => new TestInjectable()
    }
  ]
})
export class TestAppModule {}

export class TestAppNestContext {
  constructor(readonly nest: INestApplicationContext) {}
}

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
export const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({ nestModules: TestAppModule });

export const makeNestContext: MakeNestContext<TestAppNestContext> = (nest) => new TestAppNestContext(nest);

describe('nest function utilities', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminFunctionNestContext((f) => {
    describe('onCallWithNestApplicationFactory()', () => {
      it('should create a factory.', () => {
        const factory = onCallHandlerWithNestApplicationFactory();
        expect(typeof factory).toBe('function');
      });

      it('should retrieve the module.', async () => {
        const expectedValue = 0;

        // This creates a factory that we can pass handlers to, which will return another factory that accepts a nestAppGetter for our INestApplication.
        // This is to allow us to create all our functions for our app without being bound to a specific nest context, which could make testing more difficult.
        const factory = onCallHandlerWithNestApplicationFactory();

        let retrievedNestApplication = false; // use as a flag for our tests.
        const testData = { test: true }; // use as the test data to be passed to our handler.

        // Our actual handler function that is invoked by our applications.
        const handler: OnCallWithNestApplication<typeof testData, number> = (request) => {
          expect(request.nestApplication).toBeDefined();
          expect(request.data).toBeDefined();
          expect(request).toBeDefined();
          retrievedNestApplication = true;
          return expectedValue;
        };

        // Create our runnable factory.
        // This type will take in a NestApplicationPromiseGetter to build the final runnable.
        const runnableFactory: NestApplicationFunctionFactory<any> = factory(handler);

        // For our tests, we pass it the testing context's nest getter.
        // This runnable is now the cloud function that the "firebase-functions" library can consume.
        const runnable = runnableFactory(f.nestAppPromiseGetter);

        // For our tests, we use the "firebase-functions-test" wrap function to wrap it once more into a function we can use.
        // We can now execute this test function against the emulators and in our test nest context.
        const testFunction = f.fnWrapper.wrapV2CallableRequest<typeof testData>(runnable); // TODO: Update with a specific wrapOnCall when firebase functions v2 interfaces improve

        // Now we test the wrapped function. This should call our handler.
        const result = await testFunction(testData, {
          auth: null
        });

        expect(result).toBe(expectedValue);
        expect(retrievedNestApplication).toBe(true);
      });
    });
  });
});
