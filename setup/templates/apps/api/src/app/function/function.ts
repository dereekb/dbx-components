import { INestApplicationContext } from '@nestjs/common';
import { APP_CODE_PREFIXFirebaseContextAppContext, APP_CODE_PREFIX_LOWERFirebaseModelServices, APP_CODE_PREFIXFirebaseModelTypes, APP_CODE_PREFIXFirestoreCollections } from "FIREBASE_COMPONENTS_NAME";
import { onCallWithNestApplicationFactory, onCallWithNestContextFactory, taskQueueFunctionHandlerWithNestContextFactory, cloudEventHandlerWithNestContextFactory, blockingFunctionHandlerWithNestContextFactory, onEventWithNestContextFactory, AbstractFirebaseNestContext, OnCallCreateModelFunction, OnCallCreateModelMap, OnCallUpdateModelFunction, OnCallUpdateModelMap, OnCallDeleteModelMap, OnCallDeleteModelFunction } from '@dereekb/firebase-server';
import { OnCallCreateModelResult } from '@dereekb/firebase';
import { APP_CODE_PREFIXFirebaseServerActionsContext, ExampleServerActions, APP_CODE_PREFIXApiAuthService } from '../common';

export class APP_CODE_PREFIXApiNestContext extends AbstractFirebaseNestContext<APP_CODE_PREFIXFirebaseContextAppContext, typeof APP_CODE_PREFIX_LOWERFirebaseModelServices> {

  get actionContext(): APP_CODE_PREFIXFirebaseServerActionsContext {
    return this.nest.get(APP_CODE_PREFIXFirebaseServerActionsContext);
  }

  get authService(): APP_CODE_PREFIXApiAuthService {
    return this.nest.get(APP_CODE_PREFIXApiAuthService);
  }

  get APP_CODE_PREFIX_LOWERFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.nest.get(APP_CODE_PREFIXFirestoreCollections);
  }

  get exampleActions(): ExampleServerActions {
    return this.nest.get(ExampleServerActions);
  }

  get firebaseModelsService() {
    return APP_CODE_PREFIX_LOWERFirebaseModelServices;
  }

  get app(): APP_CODE_PREFIXFirestoreCollections {
    return this.APP_CODE_PREFIX_LOWERFirestoreCollections;
  }

}

export const mapAPP_CODE_PREFIXApiNestContext = (nest: INestApplicationContext) => new APP_CODE_PREFIXApiNestContext(nest);
export const onCallWithAPP_CODE_PREFIXNest = onCallWithNestApplicationFactory();
export const onCallWithAPP_CODE_PREFIXNestContext = onCallWithNestContextFactory(onCallWithAPP_CODE_PREFIXNest, mapAPP_CODE_PREFIXApiNestContext);
export const onEventWithAPP_CODE_PREFIXNestContext = onEventWithNestContextFactory(mapAPP_CODE_PREFIXApiNestContext);
export const cloudEventWithAPP_CODE_PREFIXNestContext = cloudEventHandlerWithNestContextFactory(mapAPP_CODE_PREFIXApiNestContext);
export const blockingEventWithAPP_CODE_PREFIXNestContext = blockingFunctionHandlerWithNestContextFactory(mapAPP_CODE_PREFIXApiNestContext);
export const taskqueueEventWithAPP_CODE_PREFIXNestContext = taskQueueFunctionHandlerWithNestContextFactory(mapAPP_CODE_PREFIXApiNestContext);

// MARK: CRUD Functions
export type APP_CODE_PREFIXCreateModelFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunction<APP_CODE_PREFIXApiNestContext, I, O>;
export type APP_CODE_PREFIXOnCallCreateModelMap = OnCallCreateModelMap<APP_CODE_PREFIXApiNestContext, APP_CODE_PREFIXFirebaseModelTypes>;

export type APP_CODE_PREFIXUpdateModelFunction<I, O = void> = OnCallUpdateModelFunction<APP_CODE_PREFIXApiNestContext, I, O>;
export type APP_CODE_PREFIXOnCallUpdateModelMap = OnCallUpdateModelMap<APP_CODE_PREFIXApiNestContext, APP_CODE_PREFIXFirebaseModelTypes>;

export type APP_CODE_PREFIXDeleteModelFunction<I, O = void> = OnCallDeleteModelFunction<APP_CODE_PREFIXApiNestContext, I, O>;
export type APP_CODE_PREFIXOnCallDeleteModelMap = OnCallDeleteModelMap<APP_CODE_PREFIXApiNestContext, APP_CODE_PREFIXFirebaseModelTypes>;
