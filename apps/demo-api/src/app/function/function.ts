import { INestApplicationContext } from '@nestjs/common';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { AbstractNestContext, onCallWithNestApplicationFactory, onCallWithNestContextFactory, taskQueueFunctionHandlerWithNestContextFactory, cloudEventHandlerWithNestContextFactory, blockingFunctionHandlerWithNestContextFactory, onEventWithNestContextFactory } from '@dereekb/firebase-server';
import { ProfileServerActions, GuestbookServerActions, DemoApiAuthService } from '../common';

export class DemoApiNestContext extends AbstractNestContext {
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
}

export const mapDemoApiNestContext = (nest: INestApplicationContext) => new DemoApiNestContext(nest);
export const onCallWithDemoNest = onCallWithNestApplicationFactory();
export const onCallWithDemoNestContext = onCallWithNestContextFactory(onCallWithDemoNest, mapDemoApiNestContext);
export const onEventWithDemoNestContext = onEventWithNestContextFactory(mapDemoApiNestContext);
export const cloudEventWithDemoNestContext = cloudEventHandlerWithNestContextFactory(mapDemoApiNestContext);
export const blockingEventWithDemoNestContext = blockingFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);
export const taskqueueEventWithDemoNestContext = taskQueueFunctionHandlerWithNestContextFactory(mapDemoApiNestContext);
