import { type INestApplicationContext, Injectable, Module } from '@nestjs/common';
import { initFirebaseServerAdminTestEnvironment, firebaseAdminFunctionNestContextFactory } from '@dereekb/firebase-server/test';
import { type MakeNestContext } from '../../nest.provider';
import { BlockingFunctionHandlerWithNestContextBuilderForBuilder, blockingFunctionHandlerWithNestContextFactory, makeBlockingFunctionWithHandler, NestContextBlockingFunctionHandler } from './blocking';
import { AuthBlockingEvent, beforeUserCreated } from 'firebase-functions/v2/identity';
import { BeforeCreateResponse } from 'firebase-functions/lib/common/providers/identity';

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
    describe('blockingFunctionHandlerWithNestContextFactory()', () => {
      it('should create a blocking function factory.', () => {
        const factory = blockingFunctionHandlerWithNestContextFactory(makeNestContext);
        expect(typeof factory).toBe('function');
      });
    });

    it('should provide the NestContext to the handler.', async () => {
      const factory = blockingFunctionHandlerWithNestContextFactory(makeNestContext);

      let retrievedNestApplication = false;
      const expectedResult: BeforeCreateResponse = { displayName: 'test' };

      // Our actual event handler function that is invoked by our application.
      const handler: NestContextBlockingFunctionHandler<TestAppNestContext, AuthBlockingEvent, BeforeCreateResponse> = (request) => {
        expect(request.nest).toBeDefined();
        expect(request).toBeDefined();
        retrievedNestApplication = true;

        return expectedResult;
      };

      const handlerBuilder: BlockingFunctionHandlerWithNestContextBuilderForBuilder<TestAppNestContext, typeof beforeUserCreated> = (withNest) => makeBlockingFunctionWithHandler(beforeUserCreated, withNest(handler));

      const runnableFactory = factory(handlerBuilder);

      const runnable = runnableFactory(f.nestAppPromiseGetter);

      const testEvent = f.fnWrapper.wrapBlockingFunction(runnable);

      const testData: AuthBlockingEvent = { x: 1 } as any;
      const result = await testEvent(testData);

      expect(result.displayName).toBe(expectedResult.displayName); // our test returns event. Just check that it ran and returned the value.
      expect(retrievedNestApplication).toBe(true);
    });
  });
});
