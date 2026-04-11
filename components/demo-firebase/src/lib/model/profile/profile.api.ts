import { type DownloadStorageFileParams, downloadStorageFileParamsType, type DownloadStorageFileResult, type FirebaseFunctionMapFunction, type FirebaseFunctionTypeConfigMap, type InferredTargetModelParams, inferredTargetModelParamsType, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseReadFunction, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { type Type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type ProfileTypes } from './profile';

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

/**
 * Params for initiating or completing a password reset for the current user's profile.
 *
 * Set `requestReset: true` to initiate a new password reset (generates a temporary code and sends an email).
 * Provide `resetPassword` and `newPassword` to complete the reset by verifying the code and setting the new password.
 */
export interface ResetProfilePasswordParams extends InferredTargetModelParams {
  /**
   * When true, initiates a new password reset and sends the reset email.
   */
  readonly requestReset?: Maybe<boolean>;
  /**
   * The temporary reset code received via email. Required to complete the reset.
   */
  readonly resetPassword?: Maybe<string>;
  /**
   * The new password to set. Required to complete the reset.
   */
  readonly newPassword?: Maybe<string>;
}

export const resetProfilePasswordParamsType = inferredTargetModelParamsType.merge({
  'requestReset?': clearable('boolean'),
  'resetPassword?': clearable('string'),
  'newPassword?': clearable('string')
}) as Type<ResetProfilePasswordParams>;

export type DownloadProfileArchiveParams = DownloadStorageFileParams;

export const downloadProfileArchiveParamsType = downloadStorageFileParamsType as Type<DownloadProfileArchiveParams>;

export type DownloadProfileArchiveResult = DownloadStorageFileResult;

/**
 * We set the key here to allow both the functions server and the type map/client access this shared key.
 */
export const PROFILE_SET_USERNAME_KEY = 'profileSetUsername';

/**
 * This is our FirebaseFunctionTypeMap for Profile. It defines all the functions that are available.
 */
export type ProfileFunctionTypeMap = {
  [PROFILE_SET_USERNAME_KEY]: [SetProfileUsernameParams, void];
};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [PROFILE_SET_USERNAME_KEY]: null
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
      resetPassword: ResetProfilePasswordParams;
    };
    delete: UpdateProfileParams;
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ProfileModelCrudFunctionsConfig, ProfileTypes> = {
  profile: [
    'read:downloadArchive',
    'update:_,username,onboard,createTestNotification,resetPassword' as any, // use "any" once typescript complains about combinations
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
  abstract [PROFILE_SET_USERNAME_KEY]: FirebaseFunctionMapFunction<ProfileFunctionTypeMap, 'profileSetUsername'>;
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
      updateProfileResetPassword: ModelFirebaseCrudFunction<ResetProfilePasswordParams>;
      // short names
      update: ModelFirebaseCrudFunction<UpdateProfileParams>;
      username: ModelFirebaseCrudFunction<SetProfileUsernameParams>;
      onboard: ModelFirebaseCrudFunction<FinishOnboardingProfileParams, boolean>;
      resetPassword: ModelFirebaseCrudFunction<ResetProfilePasswordParams>;
    };
    deleteProfile: ModelFirebaseCrudFunction<UpdateProfileParams>;
  };
}
