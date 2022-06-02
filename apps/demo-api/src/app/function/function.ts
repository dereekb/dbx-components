import { INestApplicationContext } from '@nestjs/common';
import { DemoFirebaseContextAppContext, demoFirebaseModelServices, DemoFirebaseModelTypes, DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { onCallWithNestApplicationFactory, onCallWithNestContextFactory, taskQueueFunctionHandlerWithNestContextFactory, cloudEventHandlerWithNestContextFactory, blockingFunctionHandlerWithNestContextFactory, onEventWithNestContextFactory, AbstractFirebaseNestContext, OnCallUpdateModelFunction, OnCallUpdateModelParams, OnCallUpdateModelMap } from '@dereekb/firebase-server';
import { ProfileServerActions, GuestbookServerActions, DemoApiAuthService } from '../common';

export class DemoApiNestContext extends AbstractFirebaseNestContext<DemoFirebaseContextAppContext, typeof demoFirebaseModelServices> {
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

  get modelsService() {
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

// MARK: Functions
export type DemoUpdateModelfunction<I, O = void> = OnCallUpdateModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallUpdateModelMap = OnCallUpdateModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;
