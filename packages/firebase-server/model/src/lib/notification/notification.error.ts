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
  NOTIFICATION_USER_HEALTH_CHECK_THROTTLED_ERROR_CODE,
  NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE,
  NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLED_ERROR_CODE,
  NOTIFICATION_BOX_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID_ERROR_CODE
} from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

/**
 * Creates an error indicating that a required notification ID was missing during creation.
 *
 * Thrown when attempting to create a {@link Notification} document without providing the mandatory ID field.
 *
 * @returns A precondition conflict error with the notification ID required error code.
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
 * @returns A precondition conflict error with the already-initialized error code.
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
 * @param key - The Firestore model key that has no registered notification model type.
 * @returns A precondition conflict error with the unregistered model type error code.
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
 * @returns A precondition conflict error with the box-not-found error code.
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
 * @returns A precondition conflict error with the invalid exclusion target error code.
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
 * @returns A precondition conflict error with the box-exists error code.
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
 * @returns A precondition conflict error with the recipient-not-found error code.
 */
export function notificationBoxRecipientDoesNotExistsError() {
  return preconditionConflictError({
    message: `An existing NotificationBox recipient for the target does not exist. You must pass insert=true to create a new recipient.`,
    code: NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE
  });
}

/**
 * Creates an error indicating that a health check was run again before its throttle window passed.
 *
 * Thrown by the {@link NotificationUser} health check when the stored check is too recent.
 *
 * @param nextRunAt - The time the next health check may be run.
 * @returns A precondition conflict error with the health-check-throttled error code.
 */
export function notificationUserHealthCheckThrottledError(nextRunAt: Date) {
  return preconditionConflictError({
    message: `A notification delivery health check was run too recently. The next one can be run at ${nextRunAt.toISOString()}.`,
    code: NOTIFICATION_USER_HEALTH_CHECK_THROTTLED_ERROR_CODE,
    data: {
      // serialized: the error's data travels to the client as JSON
      nextRunAt: nextRunAt.toISOString()
    }
  });
}

/**
 * Creates an error indicating that a test message was requested again before its throttle window passed.
 *
 * Thrown by the {@link NotificationUser} health check when a probe was dispatched too recently. Separate
 * from {@link notificationUserHealthCheckThrottledError}: running the check does not consume the test
 * message allowance.
 *
 * @param nextProbeAt - The time the next test message may be dispatched.
 * @returns A precondition conflict error with the probe-throttled error code.
 */
export function notificationUserHealthCheckProbeThrottledError(nextProbeAt: Date) {
  return preconditionConflictError({
    message: `A notification delivery test message was sent too recently. The next one can be sent at ${nextProbeAt.toISOString()}.`,
    code: NOTIFICATION_USER_HEALTH_CHECK_PROBE_THROTTLED_ERROR_CODE,
    data: {
      // serialized: the error's data travels to the client as JSON
      nextProbeAt: nextProbeAt.toISOString()
    }
  });
}

/**
 * Creates an error indicating that pending probes were verified again before their throttle window passed.
 *
 * Thrown by the {@link NotificationUser} health check on a `verifyPendingProbesOnly` run that arrives too
 * soon after the last one. Separate from {@link notificationUserHealthCheckThrottledError}: verifying an
 * in-flight test message is a poll, so it neither answers to nor consumes the user's run allowance.
 *
 * @param nextVerifyAt - The time the next verification may be run.
 * @returns A precondition conflict error with the verify-throttled error code.
 */
export function notificationUserHealthCheckVerifyThrottledError(nextVerifyAt: Date) {
  return preconditionConflictError({
    message: `The pending notification delivery test messages were verified too recently. The next verification can be run at ${nextVerifyAt.toISOString()}.`,
    code: NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLED_ERROR_CODE,
    data: {
      // serialized: the error's data travels to the client as JSON
      nextVerifyAt: nextVerifyAt.toISOString()
    }
  });
}

/**
 * Creates an error indicating that the given UID does not correspond to an existing Firebase Auth user.
 *
 * Thrown during {@link NotificationUser} creation when the provided UID cannot be found in Firebase Auth.
 *
 * @param uid - The Firebase Auth user ID that was not found.
 * @returns A precondition conflict error with the invalid-uid error code.
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
 * @param uid - The Firebase Auth user ID of the blocked user.
 * @returns A precondition conflict error with the blocked-from-add error code.
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
 * @param uid - The Firebase Auth user ID of the locked user.
 * @returns A precondition conflict error with the locked-config error code.
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
