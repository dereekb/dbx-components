import { INestApplicationContext } from '@nestjs/common';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { AbstractNestContext, onCallWithNestApplicationFactory, onCallWithNestContextFactory, onEventWithNestApplicationFactory, onEventWithNestContextFactory } from '@dereekb/firebase-server';
import { ProfileServerActions } from '../common/model/profile/profile.action.server';
import { GuestbookServerActions } from '../common/model/guestbook';

export class DemoApiNestContext extends AbstractNestContext {

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
export const onEventWithDemoNest = onEventWithNestApplicationFactory();
export const onEventWithDemoNestContext = onEventWithNestContextFactory(mapDemoApiNestContext);
