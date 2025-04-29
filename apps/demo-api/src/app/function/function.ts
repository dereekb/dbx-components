import { INestApplicationContext } from '@nestjs/common';
import { DemoFirebaseContextAppContext, demoFirebaseModelServices, DemoFirebaseModelTypes, DemoFirestoreCollections } from 'demo-firebase';
import {
  taskQueueFunctionHandlerWithNestContextFactory,
  cloudEventHandlerWithNestContextFactory,
  blockingFunctionHandlerWithNestContextFactory,
  onEventWithNestContextFactory,
  AbstractFirebaseNestContext,
  OnCallUpdateModelFunction,
  OnCallUpdateModelMap,
  OnCallDeleteModelMap,
  OnCallDeleteModelFunction,
  OnCallCreateModelFunction,
  OnCallCreateModelMap,
  OnScheduleWithNestContext,
  OnCallDevelopmentFunction,
  OnCallDevelopmentFunctionMap,
  OnCallReadModelFunction,
  OnCallReadModelMap,
  onCallHandlerWithNestContextFactory,
  onCallHandlerWithNestApplicationFactory,
  onScheduleHandlerWithNestApplicationFactory,
  onScheduleHandlerWithNestContextFactory
} from '@dereekb/firebase-server';
import { OnCallCreateModelResult } from '@dereekb/firebase';
import { ProfileServerActions, GuestbookServerActions, DemoApiAuthService, DemoFirebaseServerActionsContext } from '../common';
import { NotificationInitServerActions, NotificationServerActions } from '@dereekb/firebase-server/model';
import { SECONDS_IN_MINUTE } from '@dereekb/util';

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

  get notificationInitActions(): NotificationInitServerActions {
    return this.nest.get(NotificationInitServerActions);
  }

  get notificationActions(): NotificationServerActions {
    return this.nest.get(NotificationServerActions);
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
export const onCallWithDemoNest = onCallHandlerWithNestApplicationFactory();
export const onCallWithDemoNestContext = onCallHandlerWithNestContextFactory(onCallWithDemoNest, mapDemoApiNestContext);

export const onScheduleWithDemoNest = onScheduleHandlerWithNestApplicationFactory({
  timeoutSeconds: 10 * SECONDS_IN_MINUTE, // 10 minute timeout default
  maxInstances: 1 // only one instance allowed for scheduled functions
});
export const onScheduleWithDemoNestContext = onScheduleHandlerWithNestContextFactory(onScheduleWithDemoNest, mapDemoApiNestContext);
export const onEventWithDemoNestContext = cloudEventHandlerWithNestContextFactory(mapDemoApiNestContext);

export const cloudEventWithDemoNestContext = cloudEventHandlerWithNestContextFactory(mapDemoApiNestContext);
export const blockingEventWithDemoNestContext = blockingFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);
export const taskqueueEventWithDemoNestContext = taskQueueFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);

/**
 * Required for gen 1 auth events
 */
export const onGen1EventWithDemoNestContext = onEventWithNestContextFactory(mapDemoApiNestContext);

// MARK: CRUD Functions
export type DemoCreateModelFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallCreateModelMap = OnCallCreateModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

export type DemoReadModelFunction<I, O> = OnCallReadModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallReadModelMap = OnCallReadModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

export type DemoUpdateModelFunction<I, O = void> = OnCallUpdateModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallUpdateModelMap = OnCallUpdateModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

export type DemoDeleteModelFunction<I, O = void> = OnCallDeleteModelFunction<DemoApiNestContext, I, O>;
export type DemoOnCallDeleteModelMap = OnCallDeleteModelMap<DemoApiNestContext, DemoFirebaseModelTypes>;

// MARK: Schedule Functions
export type DemoScheduleFunction = OnScheduleWithNestContext<DemoApiNestContext>;

// MARK: Development Functions
export type DemoDevelopmentFunction<I = unknown, O = void> = OnCallDevelopmentFunction<DemoApiNestContext, I, O>;
export type DemoOnCallDevelopmentFunctionMap = OnCallDevelopmentFunctionMap<DemoApiNestContext>;
