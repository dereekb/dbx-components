import { CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE, type FirestoreModelKey, NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE, NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE, NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE, NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE, FirebaseAuthUserId, NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE, NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE } from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

export function createNotificationIdRequiredError() {
  return preconditionConflictError({
    message: `The required id was not present when attempting to create a Notification.`,
    code: CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE
  });
}

export function notificationModelAlreadyInitializedError() {
  return preconditionConflictError({
    message: `This model has already been initialized.`,
    code: NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE
  });
}

export function notificationBoxUnregistredModelTypeInitializationError(key: FirestoreModelKey) {
  return preconditionConflictError({
    message: `This NotificationBox is associated with an unregistered model type.`,
    code: NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE,
    data: {
      key
    }
  });
}

export function notificationBoxExistsForModelError() {
  return preconditionConflictError({
    message: `A NotificationBox already exists for this model.`,
    code: NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE
  });
}

export function notificationBoxRecipientDoesNotExistsError() {
  return preconditionConflictError({
    message: `An existing NotificationBox recipient for the target does not exist. You must pass insert=true to create a new recipient.`,
    code: NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE
  });
}

export function notificationUserInvalidUidForCreateError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' does not exist. Cannot create a NotificationUser for them.`,
    code: NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE,
    data: {
      uid
    }
  });
}

export function notificationUserBlockedFromBeingAddedToRecipientsError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' has blocked themselves from from being added recipients.`,
    code: NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE,
    data: {
      uid
    }
  });
}

export function notificationUserLockedConfigFromBeingUpdatedError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `The user with the uid '${uid}' has locked their config from being updated.`,
    code: NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE,
    data: {
      uid
    }
  });
}
