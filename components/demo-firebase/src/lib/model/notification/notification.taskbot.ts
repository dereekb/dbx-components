import { type NotificationTaskBotEntryId, type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptGroup, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';
import { type Maybe, type Milliseconds, MS_IN_HOUR } from '@dereekb/util';

// MARK: Groups
/**
 * The "Ping Reminders" script group. The profile's owner can turn off the demo ping, but not the required ping.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_GROUP: NotificationTaskBotScriptGroup = {
  key: 'ping_reminders',
  name: 'Ping Reminders',
  description: 'Example notifications the demo bot sends you on an interval.',
  sortOrder: 0
};

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
  historyLimit: 3,
  group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP,
  allowOwnerOptOut: true
};

// MARK: Demo Ping Required
/**
 * Script type of the demo "required ping" NotificationTaskBot script.
 *
 * Same processing as {@link DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE} and in the same group, but the owner can't opt
 * out of it: it keeps running when the owner turns the "Ping Reminders" group off.
 */
export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping_required';

/**
 * Script config for the demo required ping script.
 */
export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Required Ping',
  description: 'Sends the profile an example notification on an interval. The owner cannot opt out of it.',
  historyLimit: 3,
  group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP
};

// MARK: Registry
/**
 * All demo NotificationTaskBot script configs.
 */
export const DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];

/**
 * The demo app's NotificationTaskBot script registry.
 */
export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);
