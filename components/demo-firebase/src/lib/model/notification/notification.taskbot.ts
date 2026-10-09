import { type NotificationTaskBotEntryId, type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';
import { type Maybe, type Milliseconds, MS_IN_HOUR } from '@dereekb/util';

// MARK: Demo Ping
/**
 * Script type of the demo "ping" NotificationTaskBot script, attached to a Profile.
 *
 * Each run sends the profile an example notification, counts it, and schedules the next run after the entry's interval.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping';

/**
 * Entry id used for the demo ping script on a Profile's bot.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID: NotificationTaskBotEntryId = 'ping';

/**
 * Default interval between demo pings.
 */
export const DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL: Milliseconds = MS_IN_HOUR;

/**
 * Permanent data stored on the demo ping entry.
 */
export interface DemoPingNotificationTaskBotEntryData {
  /**
   * Number of pings sent.
   */
  readonly c?: Maybe<number>;
  /**
   * Interval between pings. Defaults to {@link DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL}.
   */
  readonly iv?: Maybe<Milliseconds>;
  /**
   * Pause the entry after this many pings.
   */
  readonly pa?: Maybe<number>;
}

/**
 * Pause reason used when the demo ping entry reaches its `pa` limit.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT = 'limit';

/**
 * Script config for the demo ping script.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Ping',
  description: 'Sends the profile an example notification on an interval.',
  historyLimit: 3
};

// MARK: Registry
/**
 * All demo NotificationTaskBot script configs.
 */
export const DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];

/**
 * The demo app's NotificationTaskBot script registry.
 */
export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);
