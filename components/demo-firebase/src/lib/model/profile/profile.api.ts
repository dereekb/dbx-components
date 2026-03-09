import { type DownloadStorageFileParams, downloadStorageFileParamsType, DownloadStorageFileResult, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, type InferredTargetModelParams, inferredTargetModelParamsType, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, ModelFirebaseReadFunction, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { type Type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { ProfileTypes } from './profile';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export interface ProfileCreateTestNotificationParams extends InferredTargetModelParams {
  readonly skipSend?: Maybe<boolean>;
  readonly expediteSend?: Maybe<boolean>;
}

export const profileCreateTestNotificationParamsType = inferredTargetModelParamsType.merge({
  'skipSend?': clearable('boolean'),
  'expediteSend?': clearable('boolean')
}) as Type<ProfileCreateTestNotificationParams>;

export interface SetProfileUsernameParams extends InferredTargetModelParams {
  readonly username: string;
}

export const setProfileUsernameParamsType = inferredTargetModelParamsType.merge({
  username: `string > 0 & string <= ${PROFILE_USERNAME_MAX_LENGTH}`
}) as Type<SetProfileUsernameParams>;

export interface UpdateProfileParams extends InferredTargetModelParams {
  readonly bio?: Maybe<string>;
}

export const updateProfileParamsType = inferredTargetModelParamsType.merge({
  'bio?': clearable(`string > 0 & string <= ${PROFILE_BIO_MAX_LENGTH}`)
}) as Type<UpdateProfileParams>;

export type FinishOnboardingProfileParams = InferredTargetModelParams;

export const finishOnboardingProfileParamsType = inferredTargetModelParamsType as Type<FinishOnboardingProfileParams>;

export type DownloadProfileArchiveParams = DownloadStorageFileParams;

export const downloadProfileArchiveParamsType = downloadStorageFileParamsType as Type<DownloadProfileArchiveParams>;

export type DownloadProfileArchiveResult = DownloadStorageFileResult;

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
      downloadArchive: ModelFirebaseReadFunction<DownloadProfileArchiveParams, DownloadProfileArchiveResult>;
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
