/**
 * @module notification.api.error
 *
 * Error code constants thrown by the notification server action service.
 * These codes are returned in Firebase function error responses for client-side handling.
 */

/**
 * Thrown when a notification creation request is missing a required ID.
 */
export const CREATE_NOTIFICATION_ID_REQUIRED_ERROR_CODE = 'CREATE_NOTIFICATION_ID_REQUIRED';

/**
 * Thrown when attempting to initialize a NotificationBox or NotificationSummary that is already initialized.
 */
export const NOTIFICATION_MODEL_ALREADY_INITIALIZED_ERROR_CODE = 'NOTIFICATION_MODEL_ALREADY_INITIALIZED';

/**
 * Thrown when the target NotificationBox does not exist.
 */
export const NOTIFICATION_BOX_DOES_NOT_EXIST_ERROR_CODE = 'NOTIFICATION_BOX_DOES_NOT_EXIST';

/**
 * Thrown when attempting to create a NotificationBox for a model that already has one.
 */
export const NOTIFICATION_BOX_EXISTS_FOR_MODEL_ERROR_CODE = 'NOTIFICATION_BOX_EXISTS_FOR_MODEL';

/**
 * Thrown when the target recipient does not exist in the NotificationBox.
 */
export const NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE = 'NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST';

/**
 * Thrown when an exclusion target is invalid (e.g., user not associated with the box).
 */
export const NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID_ERROR_CODE = 'NOTIFICATION_BOX_EXCLUSION_TARGET_INVALID';

/**
 * Thrown when the UID provided for NotificationUser creation is invalid.
 */
export const NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE = 'NOTIFICATION_USER_INVALID_UID_FOR_CREATE';

/**
 * Thrown when attempting to add a user who has blocked themselves from being added as a recipient.
 */
export const NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE = 'NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS';

/**
 * Thrown when attempting to update a recipient config that is locked by the user.
 */
export const NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE = 'NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED';
