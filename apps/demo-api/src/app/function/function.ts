import { INestApplicationContext } from '@nestjs/common';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { AbstractNestContext, onCallWithNestApplicationFactory, onCallWithNestContextFactory, onEventWithNestApplicationFactory, onEventWithNestContextFactory } from '@dereekb/firebase-server';
import { ProfileServerActions } from '../common/model/profile/profile.action.server';

export class DemoApiNestContext extends AbstractNestContext {

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.nest.get(DemoFirestoreCollections);
  }

  get profileActions(): ProfileServerActions {
    return this.nest.get(ProfileServerActions);
  }

}

export const onCallWithDemoNest = onCallWithNestApplicationFactory();
export const onCallWithDemoNestContext = onCallWithNestContextFactory(onCallWithDemoNest, (nest: INestApplicationContext) => new DemoApiNestContext(nest));
export const onEventWithDemoNest = onEventWithNestApplicationFactory();
export const onEventWithDemoNestContext = onEventWithNestContextFactory((nest: INestApplicationContext) => new DemoApiNestContext(nest));
