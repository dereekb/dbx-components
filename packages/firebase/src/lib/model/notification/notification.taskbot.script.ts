/**
 * @module notification.taskbot.script
 *
 * The NotificationTaskBot script registry: the per-script-type configuration an app declares once and both the client
 * and the server read.
 *
 * This is pure data. The server-side PROCESSING of a script is registered separately, as a
 * `NotificationTaskBotScriptProcessorConfig` keyed by the same script type, the same split `FormSpaceTypeConfig` uses.
 */
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type NotificationTaskBotScriptType } from './notification.taskbot';

/**
 * Default for {@link NotificationTaskBotScriptConfig.historyLimit}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT = 20;

/**
 * Default for {@link NotificationTaskBotScriptConfig.maxConsecutiveFailures}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Configuration for a single {@link NotificationTaskBotScriptType}.
 */
export interface NotificationTaskBotScriptConfig {
  /**
   * The script type this configuration applies to.
   */
  readonly scriptType: NotificationTaskBotScriptType;
  /**
   * Human-readable name of the script, for tooling and logs.
   */
  readonly name?: Maybe<string>;
  /**
   * Longer description of what the script does.
   */
  readonly description?: Maybe<string>;
  /**
   * Maximum number of history items kept on an entry. Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT}.
   */
  readonly historyLimit?: Maybe<number>;
  /**
   * Minimum time between the end of one run and the start of the next run scheduled by cleanup.
   *
   * Does not apply to runs requested through the API or scheduled explicitly.
   */
  readonly minimumRunInterval?: Maybe<Milliseconds>;
  /**
   * Number of consecutive failures (e.g. lost runs found by the repair sweep) before the entry is paused with the
   * `'failed'` reason. Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES}.
   */
  readonly maxConsecutiveFailures?: Maybe<number>;
}

/**
 * Record of {@link NotificationTaskBotScriptConfig} keyed by {@link NotificationTaskBotScriptType}.
 */
export type NotificationTaskBotScriptConfigRecord = Record<NotificationTaskBotScriptType, NotificationTaskBotScriptConfig>;

/**
 * Creates a {@link NotificationTaskBotScriptConfigRecord} from an array of configs.
 *
 * @param configs - The configs to index.
 * @returns A record keyed by script type.
 * @throws {Error} When two configs declare the same {@link NotificationTaskBotScriptType}.
 *
 * @example
 * ```ts
 * const record = notificationTaskBotScriptConfigRecord([{ scriptType: 'demo_ping', historyLimit: 3 }]);
 * ```
 */
export function notificationTaskBotScriptConfigRecord(configs: NotificationTaskBotScriptConfig[]): NotificationTaskBotScriptConfigRecord {
  const record: NotificationTaskBotScriptConfigRecord = {};

  configs.forEach((x) => {
    const { scriptType } = x;

    if (record[scriptType]) {
      throw new Error(`notificationTaskBotScriptConfigRecord(): duplicate NotificationTaskBotScriptType in record: ${scriptType}`);
    }

    record[scriptType] = x;
  });

  return record;
}

/**
 * Runtime service for resolving a {@link NotificationTaskBotScriptConfig} from a {@link NotificationTaskBotScriptType}.
 *
 * Built from a {@link NotificationTaskBotScriptConfigRecord} via {@link appNotificationTaskBotScriptConfigService}.
 */
export abstract class AppNotificationTaskBotScriptConfigService {
  /**
   * All registered configs for this app.
   */
  abstract readonly appNotificationTaskBotScriptConfigRecord: NotificationTaskBotScriptConfigRecord;

  /**
   * Returns the config for the given script type, falling back to a config with only the script type set.
   *
   * @param scriptType - The script type to look up.
   */
  abstract configForScriptType(scriptType: NotificationTaskBotScriptType): NotificationTaskBotScriptConfig;

  /**
   * Returns the config for the given script type, or undefined when it is not registered.
   *
   * @param scriptType - The script type to look up.
   */
  abstract registeredConfigForScriptType(scriptType: NotificationTaskBotScriptType): Maybe<NotificationTaskBotScriptConfig>;

  /**
   * Returns every registered {@link NotificationTaskBotScriptType}.
   */
  abstract getAllKnownScriptTypes(): NotificationTaskBotScriptType[];

  /**
   * Returns every registered {@link NotificationTaskBotScriptConfig}.
   */
  abstract getAllKnownScriptConfigs(): NotificationTaskBotScriptConfig[];
}

/**
 * Reference to an {@link AppNotificationTaskBotScriptConfigService} instance, for dependency injection.
 */
export interface AppNotificationTaskBotScriptConfigServiceRef {
  readonly appNotificationTaskBotScriptConfigService: AppNotificationTaskBotScriptConfigService;
}

/**
 * Creates an {@link AppNotificationTaskBotScriptConfigService} from the given record.
 *
 * @param appNotificationTaskBotScriptConfigRecord - The complete script registry for the application. Defaults to an empty record.
 * @returns The service.
 *
 * @example
 * ```ts
 * const service = appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS));
 * const config = service.configForScriptType('demo_ping');
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function appNotificationTaskBotScriptConfigService(appNotificationTaskBotScriptConfigRecord: NotificationTaskBotScriptConfigRecord = {}): AppNotificationTaskBotScriptConfigService {
  const allKnownScriptTypes = Object.keys(appNotificationTaskBotScriptConfigRecord);
  const allKnownScriptConfigs = allKnownScriptTypes.map((x) => appNotificationTaskBotScriptConfigRecord[x]);

  return {
    appNotificationTaskBotScriptConfigRecord,
    configForScriptType(scriptType: NotificationTaskBotScriptType) {
      return appNotificationTaskBotScriptConfigRecord[scriptType] ?? { scriptType };
    },
    registeredConfigForScriptType(scriptType: NotificationTaskBotScriptType) {
      return appNotificationTaskBotScriptConfigRecord[scriptType];
    },
    getAllKnownScriptTypes() {
      return [...allKnownScriptTypes];
    },
    getAllKnownScriptConfigs() {
      return [...allKnownScriptConfigs];
    }
  };
}
