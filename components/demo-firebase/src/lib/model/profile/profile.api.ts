import { Expose } from 'class-transformer';
import { FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, modelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Maybe } from '@dereekb/util';
import { ProfileTypes } from './profile';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export class ProfileParams {
  /**
   * Sets the target profile/user. If not defined, assumes the current user's profile.
   */
  @Expose()
  @IsString()
  @IsOptional()
  key?: string;
}

export class SetProfileUsernameParams extends ProfileParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(PROFILE_USERNAME_MAX_LENGTH)
  username!: string;
}

export class UpdateProfileParams extends ProfileParams {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(PROFILE_BIO_MAX_LENGTH)
  bio?: Maybe<string>;
}

export class FinishOnboardingProfileParams extends ProfileParams {}

/**
 * We set the key here to allow both the functions server and the type map/client access this shared key.
 */
export const profileSetUsernameKey = 'profileSetUsername';

/**
 * This is our FirebaseFunctionTypeMap for Profile. It defines all the functions that are available.
 */
export type ProfileFunctionTypeMap = {
  [profileSetUsernameKey]: [SetProfileUsernameParams, void];
};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [profileSetUsernameKey]: null
};

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    update: {
      _: UpdateProfileParams;
      username: SetProfileUsernameParams;
      onboard: FinishOnboardingProfileParams;
    };
    delete: UpdateProfileParams;
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ProfileModelCrudFunctionsConfig, ProfileTypes> = {
  profile: ['update:_,username,onboard', 'delete']
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const profileFunctionMap = modelFirebaseFunctionMapFactory(profileFunctionTypeConfigMap, profileModelCrudFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class ProfileFunctions implements ModelFirebaseFunctionMap<ProfileFunctionTypeMap, ProfileModelCrudFunctionsConfig> {
  abstract [profileSetUsernameKey]: FirebaseFunctionMapFunction<ProfileFunctionTypeMap, 'profileSetUsername'>;
  abstract profile: {
    updateProfile: {
      // full names
      updateProfile: ModelFirebaseCrudFunction<UpdateProfileParams>;
      updateProfileUsername: ModelFirebaseCrudFunction<SetProfileUsernameParams>;
      updateProfileOnboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams>;
      // short names
      update: ModelFirebaseCrudFunction<UpdateProfileParams>;
      username: ModelFirebaseCrudFunction<SetProfileUsernameParams>;
      onboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams>;
    };
    deleteProfile: ModelFirebaseCrudFunction<UpdateProfileParams>;
  };
}
