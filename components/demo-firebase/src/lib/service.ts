import { firebaseModelsService } from '@dereekb/firebase';
import { grantedRoleMapReader } from '@dereekb/model';
import { GuestbookTypes, profileFirebaseModelServiceFactory, profilePrivateDataFirebaseModelServiceFactory, guestbookFirebaseModelServiceFactory, guestbookEntryFirebaseModelServiceFactory, ProfileTypes, GuestbookFirebaseContext, ProfileFirebaseContext } from './models';

export type DemoFirebaseModelTypes = GuestbookTypes | ProfileTypes;

export type DemoFirebaseContext = GuestbookFirebaseContext | ProfileFirebaseContext;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookentry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profileprivate: profilePrivateDataFirebaseModelServiceFactory
};

export const demoFirebaseModelServices = firebaseModelsService<typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES, DemoFirebaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);
