import { CALENDAR_ICS_DOMAIN_NOT_CONFIGURED_ERROR_CODE, CALENDAR_ICS_ROTATE_THROTTLED_ERROR_CODE, CALENDAR_ICS_STORAGE_FILE_UNAVAILABLE_ERROR_CODE } from '@dereekb/firebase';
import { internalServerError, preconditionConflictError } from '@dereekb/firebase-server';

/**
 * Creates an error indicating the Calendar module was configured without an ICS domain.
 *
 * @returns An internal-server HttpsError with the CALENDAR_ICS_DOMAIN_NOT_CONFIGURED error code.
 */
export function calendarIcsDomainNotConfiguredError() {
  return internalServerError({
    message: `The Calendar module has no icsDomain configured, so no stable event UID can be generated.`,
    code: CALENDAR_ICS_DOMAIN_NOT_CONFIGURED_ERROR_CODE
  });
}

/**
 * Creates an error indicating the Calendar's ICS StorageFile could not be resolved or created.
 *
 * @returns A precondition-conflict HttpsError with the CALENDAR_ICS_STORAGE_FILE_UNAVAILABLE error code.
 */
export function calendarIcsStorageFileUnavailableError() {
  return preconditionConflictError({
    message: `The Calendar's ICS StorageFile is unavailable.`,
    code: CALENDAR_ICS_STORAGE_FILE_UNAVAILABLE_ERROR_CODE
  });
}

/**
 * Creates an error indicating the Calendar's ICS link was rotated again before its throttle window passed.
 *
 * Thrown by the rotate action when the calendar's stored rotation instant is too recent. The client derives
 * the same window from the same field, so reaching this error means the caller bypassed the UI.
 *
 * @param nextRotateAt - The time the next rotation is allowed.
 * @returns A precondition-conflict HttpsError with the CALENDAR_ICS_ROTATE_THROTTLED error code.
 */
export function calendarIcsRotateThrottledError(nextRotateAt: Date) {
  return preconditionConflictError({
    message: `This calendar's ICS link was rotated too recently. The next rotation can be made at ${nextRotateAt.toISOString()}.`,
    code: CALENDAR_ICS_ROTATE_THROTTLED_ERROR_CODE,
    data: {
      // serialized: the error's data travels to the client as JSON
      nextRotateAt: nextRotateAt.toISOString()
    }
  });
}
