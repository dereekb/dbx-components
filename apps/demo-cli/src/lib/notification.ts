import { type CliNotificationConfig } from '@dereekb/dbx-cli';
import { DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';
import { DEMO_CLI_NOTIFICATION_MANIFEST } from './manifest/notification.manifest.generated';

/**
 * The demo CLI's notification wiring, shared by the root `notification` catalog group and the
 * `model notificationUser settings` / `model notification tasks` / `model notification task` leaves.
 *
 * Mirrors the demo app's `userSettings` notification config (`apps/demo/src/root.app.config.ts`), so the
 * CLI lists exactly what the settings page shows. demo-api sends texts through Twilio, so no delivery
 * method is hidden.
 */
export const DEMO_CLI_NOTIFICATION_CONFIG: CliNotificationConfig = {
  templateTypeInfoRecord: DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD,
  manifest: DEMO_CLI_NOTIFICATION_MANIFEST,
  hiddenDeliveryMethods: []
};
