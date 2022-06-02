import { INestApplicationContext } from '@nestjs/common';
import { APP_CODE_PREFIXFirebaseContextAppContext, APP_CODE_PREFIX_LOWERFirebaseModelServices, APP_CODE_PREFIXFirestoreCollections  } from "FIREBASE_COMPONENTS_NAME";
import { AbstractFirebaseNestContext, onCallWithNestApplicationFactory, onCallWithNestContextFactory, onEventWithNestApplicationFactory, onEventWithNestContextFactory } from '@dereekb/firebase-server';
import { ExampleServerActions } from '../common/models/example/example.action.server';
import { APP_CODE_PREFIXApiAuthService } from '../common/firebase/auth.service';

export class APP_CODE_PREFIXApiNestContext extends AbstractFirebaseNestContext<APP_CODE_PREFIXFirebaseContextAppContext, typeof APP_CODE_PREFIX_LOWERFirebaseModelServices> {

  get authService(): APP_CODE_PREFIXApiAuthService {
    return this.nest.get(APP_CODE_PREFIXApiAuthService);
  }

  get APP_CODE_PREFIX_LOWERFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.nest.get(APP_CODE_PREFIXFirestoreCollections);
  }

  get exampleActions(): ExampleServerActions {
    return this.nest.get(ExampleServerActions);
  }

  get modelsService() {
    return APP_CODE_PREFIX_LOWERFirebaseModelServices;
  }

  get app(): APP_CODE_PREFIXFirestoreCollections {
    return this.APP_CODE_PREFIX_LOWERFirestoreCollections;
  }

}

export const mapAPP_CODE_PREFIXApiNestContext = (nest: INestApplicationContext) => new APP_CODE_PREFIXApiNestContext(nest);
export const onCallWithAPP_CODE_PREFIXNest = onCallWithNestApplicationFactory();
export const onCallWithAPP_CODE_PREFIXNestContext = onCallWithNestContextFactory(onCallWithAPP_CODE_PREFIXNest, mapAPP_CODE_PREFIXApiNestContext);
export const onEventWithAPP_CODE_PREFIXNest = onEventWithNestApplicationFactory();
export const onEventWithAPP_CODE_PREFIXNestContext = onEventWithNestContextFactory(mapAPP_CODE_PREFIXApiNestContext);
