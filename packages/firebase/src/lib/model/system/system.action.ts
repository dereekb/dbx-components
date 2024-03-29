import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { type SystemStateDocument } from './system';

export type SystemStateCreateAction<P extends object> = FirebaseFunctionCreateAction<P, SystemStateDocument>;
export type AsyncSystemStateCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, SystemStateDocument>;

export type SystemStateUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, SystemStateDocument>;
export type AsyncSystemStateUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, SystemStateDocument>;

export type SystemStateDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, SystemStateDocument>;
export type AsyncSystemStateDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, SystemStateDocument>;
