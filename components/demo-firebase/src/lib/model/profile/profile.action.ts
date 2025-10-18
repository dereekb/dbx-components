import { type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { type ProfileDocument } from './profile';

export type ProfileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, ProfileDocument>;
export type AsyncProfileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, ProfileDocument>;
