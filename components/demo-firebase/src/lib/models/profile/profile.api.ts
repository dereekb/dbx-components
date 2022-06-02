import { Expose } from 'class-transformer';
import { FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunctionConfig, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, modelFirebaseFunctionMapFactory, UpdateModelFirebaseFunction } from '@dereekb/firebase';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Maybe } from '@dereekb/util';
import { ProfileTypes } from './profile';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export class ProfileParams {
  // MARK: Admin Only
  /**
   * Sets the target profile/user. If not defined, assumes the current user's profile.
   */
  @Expose()
  @IsString()
  @IsOptional()
  uid?: string;
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

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    update: UpdateProfileParams;
    delete: UpdateProfileParams;
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ProfileModelCrudFunctionsConfig> = {
  profile: {
    update: null,
    delete: null
  },
  profilePrivate: null
};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [profileSetUsernameKey]: null
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const profileFunctionMap = modelFirebaseFunctionMapFactory(profileFunctionTypeConfigMap, profileModelCrudFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class ProfileFunctions implements ModelFirebaseFunctionMap<ProfileFunctionTypeMap, ProfileModelCrudFunctionsConfig, ProfileTypes> {
  abstract [profileSetUsernameKey]: FirebaseFunctionMapFunction<ProfileFunctionTypeMap, 'profileSetUsername'>;
  abstract;
}
