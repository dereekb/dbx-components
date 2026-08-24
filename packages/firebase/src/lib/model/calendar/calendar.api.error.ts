/**
 * @module calendar.api.error
 *
 * Error codes raised by the Calendar publish pipeline.
 */

/**
 * Thrown when the Calendar module has no ICS domain configured.
 *
 * The UID factory deliberately has no random fallback — a UID that changes between publishes makes every
 * client create a duplicate event rather than update the one it holds — so a missing domain is a hard error
 * rather than something to paper over at emit time.
 */
export const CALENDAR_ICS_DOMAIN_NOT_CONFIGURED_ERROR_CODE = 'CALENDAR_ICS_DOMAIN_NOT_CONFIGURED';

/**
 * Thrown when a Calendar's ICS StorageFile could not be resolved or created.
 */
export const CALENDAR_ICS_STORAGE_FILE_UNAVAILABLE_ERROR_CODE = 'CALENDAR_ICS_STORAGE_FILE_UNAVAILABLE';
