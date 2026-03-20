import {
  CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE,
  type FirestoreModelKey,
  NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE,
  NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE,
  NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE,
  type FirebaseAuthUserId,
  NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE,
  NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE,
  NOTIFICATION_BOX_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID_ERROR_CODE
} from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

/**
 * Creates an error indicating that a required notification ID was missing during creation.
 *
 * Thrown when attempting to create a {@link Notification} document without providing the mandatory ID field.
 *
 * @returns a precondition-conflict HttpsError with the CREATE_NOTIFICATION_ID_REQUIRED error code
 */
export function createNotificationIdRequiredError() {
  return preconditionConflictError({
    message: `The required id was not present when attempting to create a Notification.`,
    code: CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that a notification model (box or summary) has already been initialized.
 *
 * Thrown during initialization when `throwErrorIfAlreadyInitialized` is true and the model's
 * setup flag (`s`) indicates it was previously initialized.
 *
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_MODEL_ALREADY_INITIALIZED error code
 */
export function notificationModelAlreadyInitializedError() {
  return preconditionConflictError({
    message: `This model has already been initialized.`,
    code: NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that a {@link NotificationBox} is associated with an unregistered model type.
 *
 * Thrown when the model key's collection name does not match any registered notification model type.
 *
 * @param key - the Firestore model key that has no registered notification model type
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_MODEL_ALREADY_INITIALIZED error code and the offending key
 */
export function notificationBoxUnregistredModelTypeInitializationError(key: FirestoreModelKey) {
  return preconditionConflictError({
    message: `This NotificationBox is associated with an unregistered model type.`,
    code: NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE,
    data: {
      key
    }
  });
}

/**
 * Creates an error indicating that no {@link NotificationBox} exists for the target model.
 *
 * Thrown when an operation requires a NotificationBox but none has been created for the given model key.
 *
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_BOX_DOES_NOT_EXIST error code
 */
export function notificationBoxDoesNotExist() {
  return preconditionConflictError({
    message: `A NotificationBox does not exist for this model.`,
    code: NOTIFICATION_BOX_DOES_NOT_EXIST_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the exclusion target is invalid.
 *
 * Thrown when the target recipient on the {@link NotificationBox} does not exist on the box
 * or does not have a UID, making it ineligible for exclusion.
 *
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID error code
 */
export function notificationBoxExclusionTargetInvalidError() {
  return preconditionConflictError({
    message: `The target for exclusion is invalid. The target recipient on the NotificationBox must be exist on the NotificationBox and have a uid to be excluded.`,
    code: NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID_ERROR_CODE
  });
}

/**
 * Creates an error indicating that a {@link NotificationBox} already exists for this model.
 *
 * Thrown when attempting to create a duplicate NotificationBox for a model that already has one.
 *
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_BOX_EXISTS_FOR_MODEL error code
 */
export function notificationBoxExistsForModelError() {
  return preconditionConflictError({
    message: `A NotificationBox already exists for this model.`,
    code: NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the target recipient does not exist on the {@link NotificationBox}.
 *
 * Thrown when attempting to update a recipient that is not registered on the box
 * and `insert=true` was not passed to allow creating a new recipient entry.
 *
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST error code
 */
export function notificationBoxRecipientDoesNotExistsError() {
  return preconditionConflictError({
    message: `An existing NotificationBox recipient for the target does not exist. You must pass insert=true to create a new recipient.`,
    code: NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the given UID does not correspond to an existing Firebase Auth user.
 *
 * Thrown during {@link NotificationUser} creation when the provided UID cannot be found in Firebase Auth.
 *
 * @param uid - the Firebase Auth user ID that was not found
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_USER_INVALID_UID_FOR_CREATE error code and the offending uid
 */
export function notificationUserInvalidUidForCreateError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' does not exist. Cannot create a NotificationUser for them.`,
    code: NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE,
    data: {
      uid
    }
  });
}

/**
 * Creates an error indicating that the user has blocked themselves from being added as a recipient.
 *
 * Thrown when a {@link NotificationUser} has the `bk` (blocked-from-add) flag set on their config
 * and an operation attempts to insert them into a {@link NotificationBox}'s recipient list.
 *
 * @param uid - the Firebase Auth user ID of the blocked user
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS error code and the offending uid
 */
export function notificationUserBlockedFromBeingAddedToRecipientsError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' has blocked themselves from from being added recipients.`,
    code: NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE,
    data: {
      uid
    }
  });
}

/**
 * Creates an error indicating that the user has locked their notification configuration from external updates.
 *
 * Thrown when a {@link NotificationUser} has the `lk` (locked) flag set on their config
 * and an operation attempts to modify their recipient settings on a {@link NotificationBox}.
 *
 * @param uid - the Firebase Auth user ID of the locked user
 * @returns a precondition-conflict HttpsError with the NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED error code and the offending uid
 */
export function notificationUserLockedConfigFromBeingUpdatedError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' has locked their config from being updated.`,
    code: NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE,
    data: {
      uid
    }
  });
}
