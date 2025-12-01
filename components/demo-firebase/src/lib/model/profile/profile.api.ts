import { Expose } from 'class-transformer';
import { DownloadStorageFileParams, DownloadStorageFileResult, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, InferredTargetModelParams, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, StorageFileSignedDownloadUrl, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { type Maybe } from '@dereekb/util';
import { ProfileTypes } from './profile';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export class ProfileCreateTestNotificationParams extends InferredTargetModelParams {
  @Expose()
  @IsBoolean()
  @IsOptional()
  skipSend?: Maybe<boolean>;

  /**
   * If true, will expedite the sending of the notification.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  expediteSend?: Maybe<boolean>;
}

export class SetProfileUsernameParams extends InferredTargetModelParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(PROFILE_USERNAME_MAX_LENGTH)
  username!: string;
}

export class UpdateProfileParams extends InferredTargetModelParams {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(PROFILE_BIO_MAX_LENGTH)
  bio?: Maybe<string>;
}

export class FinishOnboardingProfileParams extends InferredTargetModelParams {}

export class DownloadProfileArchiveParams extends DownloadStorageFileParams {}

export interface DownloadProfileArchiveResult extends DownloadStorageFileResult {}

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
    read: {
      downloadArchive: [DownloadProfileArchiveParams, DownloadProfileArchiveResult];
    };
    update: {
      _: UpdateProfileParams;
      username: SetProfileUsernameParams;
      onboard: [FinishOnboardingProfileParams, boolean];
      createTestNotification: ProfileCreateTestNotificationParams;
    };
    delete: UpdateProfileParams;
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ProfileModelCrudFunctionsConfig, ProfileTypes> = {
  profile: [
    'read:downloadArchive',
    'update:_,username,onboard,createTestNotification' as any, // use "any" once typescript complains about combinations
    'delete'
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
  abstract [profileSetUsernameKey]: FirebaseFunctionMapFunction<ProfileFunctionTypeMap, 'profileSetUsername'>;
  abstract profile: {
    readProfile: {
      downloadArchive: ModelFirebaseCrudFunction<DownloadProfileArchiveParams, DownloadProfileArchiveResult>;
    };
    updateProfile: {
      // full names
      updateProfile: ModelFirebaseCrudFunction<UpdateProfileParams>;
      updateProfileUsername: ModelFirebaseCrudFunction<SetProfileUsernameParams>;
      updateProfileOnboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams, boolean>;
      createTestNotification: ModelFirebaseCrudFunction<ProfileCreateTestNotificationParams>;
      // short names
      update: ModelFirebaseCrudFunction<UpdateProfileParams>;
      username: ModelFirebaseCrudFunction<SetProfileUsernameParams>;
      onboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams, boolean>;
    };
    deleteProfile: ModelFirebaseCrudFunction<UpdateProfileParams>;
  };
}
