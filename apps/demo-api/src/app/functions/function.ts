import { INestApplication } from '@nestjs/common';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { AbstractNestContext, onCallWithNestApplicationFactory, onCallWithNestContextFactory } from '@dereekb/firebase-server';
import { getNestServerApp } from '../app';
import { ProfileServerActions } from '../common/model/profile/profile.action.server';

export class DemoApiNestContext extends AbstractNestContext {

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.nest.get(DemoFirestoreCollections);
  }

  get profileActions(): ProfileServerActions {
    return this.nest.get(ProfileServerActions);
  }

}

export const onCallWithNestApp = onCallWithNestApplicationFactory(getNestServerApp);
export const onCallWithNestContext = onCallWithNestContextFactory(onCallWithNestApp, (nest: INestApplication) => new DemoApiNestContext(nest));
