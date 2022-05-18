import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import { Injectable, Module } from '@nestjs/common';
import { initFirebaseServerAdminTestEnvironment, firebaseAdminFunctionNestContextFactory } from '@dereekb/firebase-server/test';
import { OnCallWithNestApplication, onCallWithNestApplicationFactory } from './call';
import { onEventWithNestApplicationFactory, NestApplicationEventHandler, OnEventWithNestApplicationBuilder } from './event';
import * as functions from 'firebase-functions';
import { NestApplicationFunctionFactory } from '../../nest.provider';

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

        // For our tests, we use the "firebase-functions-test" wrap function to wrap it once more into a function we can use.
        // We can now execute this test function against the emulators and in our test nest context.
        const testFunction = f.fnWrapper.wrapV1CloudFunction<typeof testData>(runnable);

        // Now we test the wrapped function. This should call our handler.
        const result = await testFunction(testData);

        expect(result).toBe(expectedValue);
        expect(retrievedNestApplication).toBe(true);
      });

    });

    describe('onEventWithNestApplicationFactory()', () => {

      it('should create a factory.', () => {
        const factory = onEventWithNestApplicationFactory();
        expect(typeof factory).toBe('function');
      });

      it('should retrieve the module.', async () => {
        let retrievedNestApplication = false; // use as a flag for our tests.

        // This creates a factory that we can pass event handlers to, which will return another factory that accepts a nestAppGetter for our INestApplication.
        // This is to allow us to create all our events for our app without being bound to a specific nest context, which could make testing more difficult.
        const factory = onEventWithNestApplicationFactory();

        // Our actual event handler function that is invoked by our application.
        const handler: NestApplicationEventHandler<UserRecord> = (nest, data: UserRecord, context) => {
          expect(nest).toBeDefined();
          retrievedNestApplication = true;
          return data;
        };

        /*
          Because different events are defined through different interfaces compared to onCall (which is directly defined as functions.https.onCall), 
          the OnEventWithNestApplicationBuilder type is used to return the CloudFunction result, and passes a builder which we can pass the handler to.
        */
        const handlerBuilder: OnEventWithNestApplicationBuilder<UserRecord> = (withNest) => functions.auth.user().onCreate(withNest(handler));

        // Create our runnable factory.
        // This type will take in a NestApplicationPromiseGetter to build the final runnable.
        const runnableFactory: NestApplicationFunctionFactory<any> = factory(handlerBuilder);

        // For our tests, we pass it the testing context's nest getter.
        // This runnable is now the cloud function that the "firebase-functions" library can consume.
        const runnable = runnableFactory(f.nestAppPromiseGetter);

        // For our tests, we use the "firebase-functions-test" wrap function to wrap our event into a function we can use.
        // We can now execute our event. This event does not execute automatically and is not magically subscribed.
        // Do not expect it to be listening for the events it is subscribed to. For those kinds of tests, look at headless E2E testing that uses the functions emulator.
        const testEvent = f.fnWrapper.wrapV1CloudFunction<typeof testData>(runnable);

        const testData: UserRecord = {} as any;
        const result = await testEvent(testData);

        expect(result).toBe(testData);
      });

    });

  });

});
