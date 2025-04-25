import { Expose } from 'class-transformer';
import { FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, InferredTargetModelParams, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { type Maybe } from '@dereekb/util';
import { ProfileTypes } from './profile';

export class UpdateProfileParams extends InferredTargetModelParams { }

export class FinishOnboardingProfileParams extends InferredTargetModelParams { }

/**
 * This is our FirebaseFunctionTypeMap for Profile. It defines all the functions that are available.
 */
export type ProfileFunctionTypeMap = {};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {};

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    update: {
      _: UpdateProfileParams;
      onboard: [FinishOnboardingProfileParams, boolean];
    };
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ProfileModelCrudFunctionsConfig, ProfileTypes> = {
  profile: [
    'update:_,onboard' as any, // use "any" once typescript complains about combinations
  ]
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const profileFunctionMap = callModelFirebaseFunctionMapFactory(profileFunctionTypeConfigMap, profileModelCrudFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class ProfileFunctions implements ModelFirebaseFunctionMap<ProfileFunctionTypeMap, ProfileModelCrudFunctionsConfig> {
  abstract profile: {
    updateProfile: {
      update: ModelFirebaseCrudFunction<UpdateProfileParams>;
      onboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams, boolean>;
    };
  };
}
