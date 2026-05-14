import { type DownloadStorageFileParams, type DownloadStorageFileResult, type FirebaseFunctionMapFunction, type FirebaseFunctionTypeConfigMap, type InferredTargetModelParams, inferredTargetModelParamsType, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseReadFunction, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { type Type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type ProfileTypes } from './profile';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

/**
 * Params for creating a test notification on the current user's profile.
 *
 * Used by the demo to exercise the notification pipeline end-to-end without
 * triggering a real notification trigger.
 */
export interface ProfileCreateTestNotificationParams extends InferredTargetModelParams {
  /**
   * When true, the notification is created in the database but not enqueued
   * for sending. Useful for inspecting the persisted record without consuming
   * a delivery slot.
   */
  readonly skipSend?: Maybe<boolean>;
  /**
   * When true, the notification is sent immediately via the expedite service
   * rather than waiting for the regular send window.
   */
  readonly expediteSend?: Maybe<boolean>;
}

export const profileCreateTestNotificationParamsType = inferredTargetModelParamsType.merge({
  'skipSend?': clearable('boolean'),
  'expediteSend?': clearable('boolean')
}) as Type<ProfileCreateTestNotificationParams>;

/**
 * Params for changing the current user's profile username.
 *
 * Usernames are normalized to lowercase server-side and must be unique across
 * all profiles.
 */
export interface SetProfileUsernameParams extends InferredTargetModelParams {
  /**
   * Desired username. 1-30 characters; case-insensitive and unique. The server
   * lowercases the value before persisting and rejects collisions with the
   * `usernameAlreadyTaken` error.
   */
  readonly username: string;
}

export const setProfileUsernameParamsType = inferredTargetModelParamsType.merge({
  username: `string > 0 & string <= ${PROFILE_USERNAME_MAX_LENGTH}`
}) as Type<SetProfileUsernameParams>;

/**
 * Params for updating the editable fields on the current user's profile.
 *
 * Only fields explicitly provided are updated (merge-set). Pass `null` to
 * clear an optional field.
 */
export interface UpdateProfileParams extends InferredTargetModelParams {
  /**
   * Free-form profile bio, capped at 200 characters. Pass `null` to clear.
   */
  readonly bio?: Maybe<string>;
}

export const updateProfileParamsType = inferredTargetModelParamsType.merge({
  'bio?': clearable(`string > 0 & string <= ${PROFILE_BIO_MAX_LENGTH}`)
}) as Type<UpdateProfileParams>;

export type FinishOnboardingProfileParams = InferredTargetModelParams;

export { inferredTargetModelParamsType as finishOnboardingProfileParamsType } from '@dereekb/firebase';

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

export { downloadStorageFileParamsType as downloadProfileArchiveParamsType } from '@dereekb/firebase';

export type DownloadProfileArchiveResult = DownloadStorageFileResult;

/**
 * We set the key here to allow both the functions server and the type map/client access this shared key.
 */
export const PROFILE_SET_USERNAME_KEY = 'profileSetUsername';

/**
 * This is our FirebaseFunctionTypeMap for Profile. It defines all the functions that are available.
 */
export type ProfileFunctionTypeMap = {
  /**
   * Standalone callable that sets the current user's profile username.
   *
   * Equivalent to `profile update-username` but exposed as a top-level
   * Firebase function for clients that prefer the direct entrypoint.
   */
  [PROFILE_SET_USERNAME_KEY]: [SetProfileUsernameParams, void];
};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [PROFILE_SET_USERNAME_KEY]: null
};

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    read: {
      /**
       * Generates and returns a signed URL for downloading a ZIP archive of
       * the current user's profile data. The archive is generated on demand
       * and the URL expires after a short window.
       */
      downloadArchive: [DownloadProfileArchiveParams, DownloadProfileArchiveResult];
    };
    update: {
      /**
       * Updates editable fields on the current user's profile (currently `bio`).
       *
       * Performs a merge-set so only the provided fields are overwritten.
       * Pass `null` for an optional field to clear it.
       */
      _: UpdateProfileParams;
      /**
       * Sets the current user's profile username.
       *
       * Normalizes to lowercase, checks for conflicts with existing profiles,
       * and updates the private data's `usernameSetAt` timestamp when the
       * value actually changed. Throws `usernameAlreadyTaken` when the
       * requested username belongs to another profile.
       */
      username: SetProfileUsernameParams;
      /**
       * Marks onboarding complete for the current user.
       *
       * Initializes the profile document if it does not exist, then grants the
       * `onboarded` and `tos-signed` auth roles. Returns `true` on success.
       */
      onboard: [FinishOnboardingProfileParams, boolean];
      /**
       * Creates a test notification on the current user's profile to exercise
       * the notification pipeline.
       *
       * Caps the number of test notifications per profile at 6 (throws when
       * exceeded). Honors `skipSend` to persist without enqueuing, and
       * `expediteSend` to dispatch immediately via the expedite service.
       */
      createTestNotification: ProfileCreateTestNotificationParams;
      /**
       * Initiates or completes a password reset for the current user.
       *
       * Set `requestReset: true` to start a new reset (generates a temporary
       * code and sends an email). Provide `resetPassword` + `newPassword` to
       * complete the reset by verifying the code and setting the new password.
       */
      resetPassword: ResetProfilePasswordParams;
    };
    /**
     * Deletes the current user's profile and associated private data.
     *
     * Currently aliased to `UpdateProfileParams` for the params shape — only
     * the inferred target key is consumed.
     */
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
