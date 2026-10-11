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
import { isNotificationTaskBotScriptGroupKey, type NotificationTaskBotScriptGroupKey } from './notification.id';

/**
 * Default for {@link NotificationTaskBotScriptConfig.historyLimit}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT = 20;

/**
 * Default for {@link NotificationTaskBotScriptConfig.maxConsecutiveFailures}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * A topic that groups NotificationTaskBot scripts, e.g. "Email reminders".
 *
 * The bot's owner opts out of a group at once, which stops every entry in the group whose script sets
 * {@link NotificationTaskBotScriptConfig.allowOwnerOptOut}.
 *
 * Same shape as NotificationTemplateTypeInfoGroup. Every script config that references a group key must use the same
 * definition.
 */
export interface NotificationTaskBotScriptGroup {
  /**
   * Unique key of the group.
   */
  readonly key: NotificationTaskBotScriptGroupKey;
  /**
   * Human-readable group name shown to the owner.
   */
  readonly name: string;
  /**
   * Optional description shown to the owner with the group name.
   */
  readonly description?: Maybe<string>;
  /**
   * Sort order of the group relative to the other groups. Lower values are shown first.
   */
  readonly sortOrder?: Maybe<number>;
}

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
  /**
   * The group (topic) this script belongs to.
   */
  readonly group?: Maybe<NotificationTaskBotScriptGroup>;
  /**
   * Whether the bot's owner may opt out of this script by turning off its {@link group}. Requires {@link group}.
   *
   * Defaults to false. A script in a group without this flag keeps running when the owner turns that group off.
   */
  readonly allowOwnerOptOut?: Maybe<boolean>;
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
 * @throws {Error} When two configs declare the same {@link NotificationTaskBotScriptType}, a config sets
 * `allowOwnerOptOut` without a group, a group key is invalid, or two configs define the same group key differently.
 *
 * @example
 * ```ts
 * const record = notificationTaskBotScriptConfigRecord([{ scriptType: 'demo_ping', historyLimit: 3 }]);
 * ```
 */
export function notificationTaskBotScriptConfigRecord(configs: NotificationTaskBotScriptConfig[]): NotificationTaskBotScriptConfigRecord {
  const record: NotificationTaskBotScriptConfigRecord = {};
  const groupsByKey = new Map<NotificationTaskBotScriptGroupKey, NotificationTaskBotScriptGroup>();

  configs.forEach((x) => {
    const { scriptType, group, allowOwnerOptOut } = x;

    if (record[scriptType]) {
      throw new Error(`notificationTaskBotScriptConfigRecord(): duplicate NotificationTaskBotScriptType in record: ${scriptType}`);
    }

    if (allowOwnerOptOut && group == null) {
      throw new Error(`notificationTaskBotScriptConfigRecord(): NotificationTaskBotScriptType "${scriptType}" sets allowOwnerOptOut without a group.`);
    }

    if (group != null) {
      if (!isNotificationTaskBotScriptGroupKey(group.key)) {
        throw new Error(`notificationTaskBotScriptConfigRecord(): invalid NotificationTaskBotScriptGroupKey "${group.key}" on NotificationTaskBotScriptType "${scriptType}".`);
      }

      const existingGroup = groupsByKey.get(group.key);

      if (existingGroup == null) {
        groupsByKey.set(group.key, group);
      } else if (existingGroup !== group && (existingGroup.name !== group.name || existingGroup.description !== group.description || existingGroup.sortOrder !== group.sortOrder)) {
        throw new Error(`notificationTaskBotScriptConfigRecord(): conflicting NotificationTaskBotScriptGroup definitions for group key "${group.key}" on NotificationTaskBotScriptType "${scriptType}".`);
      }
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

  /**
   * Returns the group key the owner can opt out of for the given script type, or undefined when the script is not
   * registered, has no group, or does not set {@link NotificationTaskBotScriptConfig.allowOwnerOptOut}.
   *
   * @param scriptType - The script type to look up.
   */
  abstract optOutGroupKeyForScriptType(scriptType: NotificationTaskBotScriptType): Maybe<NotificationTaskBotScriptGroupKey>;

  /**
   * Returns the group for the given key when at least one registered script allows the owner to opt out of it.
   *
   * @param groupKey - The group key to look up.
   */
  abstract optOutGroupForKey(groupKey: NotificationTaskBotScriptGroupKey): Maybe<NotificationTaskBotScriptGroup>;
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
  const optOutGroupKeysByScriptType = new Map<NotificationTaskBotScriptType, NotificationTaskBotScriptGroupKey>();
  const optOutGroupsByKey = new Map<NotificationTaskBotScriptGroupKey, NotificationTaskBotScriptGroup>();

  allKnownScriptConfigs.forEach((config) => {
    const { group } = config;

    if (config.allowOwnerOptOut && group != null) {
      optOutGroupKeysByScriptType.set(config.scriptType, group.key);
      optOutGroupsByKey.set(group.key, group);
    }
  });

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
    },
    optOutGroupKeyForScriptType(scriptType: NotificationTaskBotScriptType) {
      return optOutGroupKeysByScriptType.get(scriptType);
    },
    optOutGroupForKey(groupKey: NotificationTaskBotScriptGroupKey) {
      return optOutGroupsByKey.get(groupKey);
    }
  };
}
