import { DemoFirestoreCollections } from './collection';
import { GuestbookTypes, profileFirebaseModelServiceFactory, profilePrivateDataFirebaseModelServiceFactory, guestbookFirebaseModelServiceFactory, guestbookEntryFirebaseModelServiceFactory, ProfileTypes } from './models';

export type DemoFirebaseModelTypes = GuestbookTypes | ProfileTypes;

export interface DemoFirebaseModelServiceConfig {
  readonly demoFirestoreCollections: DemoFirestoreCollections;
}

export type DemoFirebaseContext = {};

export const DEMO_FIREBASE_MODEL_SERVICES = {
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookentry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profileprivate: profilePrivateDataFirebaseModelServiceFactory
};
