import { FirebaseAppModelContext } from '@dereekb/firebase';
import { GuestbookTypes, GuestbookFirestoreCollections } from './guestbook';
import { ProfileTypes, ProfileFirebaseContext } from './profile';

// todo...

export type GuestbookFirebaseContext = FirebaseAppModelContext<GuestbookFirestoreCollections>;

export type GuestbookModelServiceFactories = {};

export type DemoFirebaseModelTypes = GuestbookTypes | ProfileTypes;

export type DemoFirebaseContext = GuestbookFirebaseContext | ProfileFirebaseContext;
