import { AsyncFirebaseFunctionUpdateAction, FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { ProfileDocument } from './profile';

export type ProfileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, ProfileDocument>;
export type AsyncProfileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, ProfileDocument>;
