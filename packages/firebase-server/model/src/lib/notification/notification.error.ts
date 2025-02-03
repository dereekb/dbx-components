import { CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE, type FirestoreModelKey, NOTIFICATION_BOX_ALREADY_INITIALIZED_ERROR_CODE, NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE, NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE } from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

export function createNotificationIdRequiredError() {
  return preconditionConflictError({
    message: `The required id was not present when attempting to create a Notification.`,
    code: CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE
  });
}

export function notificationBoxAlreadyInitializedError() {
  return preconditionConflictError({
    message: `This NotificationBox has already been initialized.`,
    code: NOTIFICATION_BOX_ALREADY_INITIALIZED_ERROR_CODE
  });
}

export function notificationBoxUnregistredModelTypeInitializationError(key: FirestoreModelKey) {
  return preconditionConflictError({
    message: `This NotificationBox has already been initialized.`,
    code: NOTIFICATION_BOX_ALREADY_INITIALIZED_ERROR_CODE,
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
    message: `A NotificationBox does not exist for this model.`,
    code: NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE
  });
}
