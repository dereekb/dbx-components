import { INestApplicationContext, Injectable, Module } from '@nestjs/common';
import { initFirebaseServerAdminTestEnvironment, firebaseAdminFunctionNestContextFactory } from '@dereekb/firebase-server/test';
import { StorageEvent } from 'firebase-functions/v2/storage';
import { storage } from 'firebase-functions/v2';
import { CloudEventHandlerWithNestContextBuilder, cloudEventHandlerWithNestContextFactory, NestContextCloudEventHandler } from './event';
import { MakeNestContext } from '../../nest.provider';

@Injectable()
class TestInjectable {}

@Module({
  providers: [
    {
      provide: TestInjectable,
      useFactory: () => new TestInjectable()
    }
  ]
})
class TestAppModule {}

class TestAppNestContext {
  constructor(readonly nest: INestApplicationContext) {}
}

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({ nestModules: TestAppModule });

const makeNestContext: MakeNestContext<TestAppNestContext> = (nest) => new TestAppNestContext(nest);

describe('nest function utilities', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminFunctionNestContext((f) => {
    describe('cloudEventHandlerWithNestContextFactory()', () => {
      it('should create a factory.', () => {
        const factory = cloudEventHandlerWithNestContextFactory(makeNestContext);
        expect(typeof factory).toBe('function');
      });

      it('should retrieve the module.', async () => {
        let retrievedNestApplication = false;

        const factory = cloudEventHandlerWithNestContextFactory(makeNestContext);

        const expectedResult = { x: 1 };

        // Our actual event handler function that is invoked by our application.
        const handler: NestContextCloudEventHandler<TestAppNestContext, StorageEvent> = (nest, event) => {
          expect(nest).toBeDefined();
          expect(event).toBeDefined();
          retrievedNestApplication = true;
          return expectedResult;
        };

        const handlerBuilder: CloudEventHandlerWithNestContextBuilder<TestAppNestContext, StorageEvent> = (withNest) => storage.onObjectFinalized(withNest(handler));

        // Create our runnable factory.
        const runnableFactory = factory(handlerBuilder);

        // make the runnable
        const runnable = runnableFactory(f.nestAppPromiseGetter);

        const testEvent = f.fnWrapper.wrapV2CloudFunction(runnable);

        const testData: StorageEvent = { x: 1 } as any;
        const result = await testEvent(testData);

        expect(result.x).toBe(expectedResult.x); // our test returns event. Just check that it ran and returned the value.
        expect(retrievedNestApplication).toBe(true);
      });
    });
  });
});
