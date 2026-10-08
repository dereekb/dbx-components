/**
 * Build-time notification manifest (`notification.manifest.json`): the
 * `dbx_notification_m_list_app` report plus the `dbx_notification_m_validate_app`
 * findings from one extraction. Written by `dbx-cli-generate-notification-manifest`.
 */

export { buildNotificationManifest, notificationManifestFindingFromViolation } from './build.js';
export { NOTIFICATION_MANIFEST_VERSION, type BuildNotificationManifestInput, type BuildNotificationManifestResult, type NotificationManifest, type NotificationManifestApp, type NotificationManifestFinding } from './types.js';
