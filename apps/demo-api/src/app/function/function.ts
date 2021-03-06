import { INestApplicationContext } from '@nestjs/common';
import { DemoFirebaseContextAppContext, demoFirebaseModelServices, DemoFirebaseModelTypes, DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { onCallWithNestApplicationFactory, onCallWithNestContextFactory, taskQueueFunctionHandlerWithNestContextFactory, cloudEventHandlerWithNestContextFactory, blockingFunctionHandlerWithNestContextFactory, onEventWithNestContextFactory, AbstractFirebaseNestContext, OnCallUpdateModelFunction, OnCallUpdateModelMap, OnCallDeleteModelMap, OnCallDeleteModelFunction, OnCallCreateModelFunction, OnCallCreateModelMap } from '@dereekb/firebase-server';
import { OnCallCreateModelResult } from '@dereekb/firebase';
import { ProfileServerActions, GuestbookServerActions, DemoApiAuthService, DemoFirebaseServerActionsContext } from '../common';

export class DemoApiNestContext extends AbstractFirebaseNestContext<DemoFirebaseContextAppContext, typeof demoFirebaseModelServices> {
  get actionContext(): DemoFirebaseServerActionsContext {
    return this.nest.get(DemoFirebaseServerActionsContext);
  }

  get authService(): DemoApiAuthService {
    return this.nest.get(DemoApiAuthService);
  }

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.nest.get(DemoFirestoreCollections);
  }

  get profileActions(): ProfileServerActions {
    return this.nest.get(ProfileServerActions);
  }

  get guestbookActions(): GuestbookServerActions {
    return this.nest.get(GuestbookServerActions);
  }

  get firebaseModelsService() {
    return demoFirebaseModelServices;
  }

  get app(): DemoFirestoreCollections {
    return this.demoFirestoreCollections;
  }
}

export const mapDemoApiNestContext = (nest: INestApplicationContext) => new DemoApiNestContext(nest);
export const onCallWithDemoNest = onCallWithNestApplicationFactory();
export const onCallWithDemoNestContext = onCallWithNestContextFactory(onCallWithDemoNest, mapDemoApiNestContext);
export const onEventWithDemoNestContext = onEventWithNestContextFactory(mapDemoApiNestContext);
export const cloudEventWithDemoNestContext = cloudEventHandlerWithNestContextFactory(mapDemoApiNestContext);
export const blockingEventWithDemoNestContext = blockingFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);
export const taskqueueEventWithDemoNestContext = taskQueueFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);

// MARK: CRUD Functions
export type DemoCreateModelfunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallCreateModelMap = OnCallCreateModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

export type DemoUpdateModelfunction<I, O = void> = OnCallUpdateModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallUpdateModelMap = OnCallUpdateModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

export type DemoDeleteModelfunction<I, O = void> = OnCallDeleteModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallDeleteModelMap = OnCallDeleteModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;
