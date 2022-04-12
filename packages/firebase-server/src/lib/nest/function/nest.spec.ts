import { Injectable, Module } from '@nestjs/common';
import { firebaseAdminFunctionNestContextFactory } from '../../../test/firebase/firebase.admin.nest';
import { initFirebaseServerAdminTestEnvironment } from '../../../test/firebase/firebase.admin.test.server';
import { NestApplicationFunctionFactory, OnCallWithNestApplication, onCallWithNestApplicationFactory } from './nest';

@Injectable()
export class TestInjectable { }

@Module({
  providers: [{
    provide: TestInjectable,
    useFactory: () => new TestInjectable()
  }]
})
export class TestAppModule { }

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
export const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({ nestModules: TestAppModule });

describe('nest function utilities', () => {

  initFirebaseServerAdminTestEnvironment();

  firebaseAdminFunctionNestContext((f) => {

    describe('onCallWithNestApplicationFactory()', () => {

      it('should create a factory.', () => {
        const factory = onCallWithNestApplicationFactory();
        expect(typeof factory).toBe('function');
      });

      it('should retrieve the module.', async () => {
        const expectedValue = 0;

        // This creates a factory that we can pass handlers to, which will return another factory that accepts a nestAppGetter for our INestApplication.
        // This is to allow us to create all our functions for our app without being bound to a specific nest context, which could make testing more difficult.
        const factory = onCallWithNestApplicationFactory();

        let retrievedNestApplication = false; // use as a flag for our tests.
        const testData = { test: true };  // use as the test data to be passed to our handler.

        // Our actual handler function that is invoked by our applications.
        const handler: OnCallWithNestApplication<any, number> = (nest, data: typeof testData, context) => {
          expect(nest).toBeDefined();
          retrievedNestApplication = true;
          return expectedValue;
        };

        // Create our runnable factory.
        // This type will take in a NestApplicationPromiseGetter to build the final runnable.
        const runnableFactory: NestApplicationFunctionFactory<any> = factory(handler);

        // For our tests, we pass it the testing context's nest getter.
        // This runnable is now the cloud function that the "firebase-functions" library can consume.
        const runnable = runnableFactory(f.nestAppPromiseGetter);

        console.log('F: ', f.instance);

        // For our tests, we use the "firebase-functions-test" wrap function to wrap it once more into a function we can use.
        // We can now execute this test function against the emulators and in our test nest context.
        const testFunction = f.instance.wrapCloudFunction(runnable);

        // Now we test the wrapped function. This should call our handler.
        const result = await testFunction(testData);

        expect(result).toBe(expectedValue);

      });

    });

  });

});
