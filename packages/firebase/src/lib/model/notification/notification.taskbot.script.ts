/**
 * @module notification.taskbot.script
 *
 * The NotificationTaskBot script registry: the per-script-type configuration an app declares once and both the client
 * and the server read.
 *
 * This is pure data, plus an optional arktype `dataType` per script. Both the client and the server read the registry.
 * The server-side PROCESSING of a script is registered separately, as a `NotificationTaskBotScriptProcessorConfig` keyed
 * by the same script type, the same split `FormSpaceTypeConfig` uses.
 */
import { type Type } from 'arktype';
import { arrayToObject, type Maybe, type Milliseconds, MS_IN_MINUTE, typedConfigRegistry } from '@dereekb/util';
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
 * Default for {@link NotificationTaskBotScriptConfig.minimumRunInterval}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL: Milliseconds = 5 * MS_IN_MINUTE;

/**
 * What the repair sweep does with a LOST run: one whose task went missing, or finished without its cleanup.
 *
 * Every lost run is recorded as LOST in the entry's history and adds 1 to its failure count (`fc`). Then:
 * - `'stop'`: pauses the entry with the `'failed'` reason. No new run starts until an admin resumes the entry
 *   (`update:entry` with `pause: false`) or forces a run (`update:run` with FORCED).
 * - `'idle'`: leaves the entry idle, so the app's next `ensure` (schedule `'ifIdle'`) re-arms it. For apps that re-arm
 *   their bots on their own schedule.
 * - `'retry'`: issues a new run due now.
 *
 * Under `'idle'` and `'retry'`, the entry is paused with `'failed'` instead once its failure count reaches the script's
 * `maxConsecutiveFailures`.
 */
export type NotificationTaskBotLostRunPolicy = 'stop' | 'idle' | 'retry';

/**
 * Default for {@link NotificationTaskBotScriptConfig.lostRunPolicy}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_LOST_RUN_POLICY: NotificationTaskBotLostRunPolicy = 'stop';

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
   * Minimum time between the end of a run and the start of the next run its cleanup schedules, explicit or not.
   *
   * Keeps a script whose cleanup and due check both say "now" from running over and over within one
   * `sendQueuedNotifications` call. Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL}; `0`
   * turns it off.
   *
   * Does not apply to runs scheduled through the API, `ensure`, or the other helpers.
   */
  readonly minimumRunInterval?: Maybe<Milliseconds>;
  /**
   * Number of consecutive failures before the entry is paused with the `'failed'` reason. Counts runs whose cleanup
   * reports FAILED, as well as lost runs found by the repair sweep. Defaults to
   * {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES}.
   *
   * Under `lostRunPolicy: 'stop'` a lost run pauses the entry at once.
   */
  readonly maxConsecutiveFailures?: Maybe<number>;
  /**
   * What the repair sweep does when a run's task goes missing or finishes without its cleanup. Defaults to
   * {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_LOST_RUN_POLICY} (`'stop'`). See {@link NotificationTaskBotLostRunPolicy}.
   */
  readonly lostRunPolicy?: Maybe<NotificationTaskBotLostRunPolicy>;
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
  /**
   * arktype type of the entry data (`d`) this script keeps.
   *
   * Setting it opts the script in to data patches through the `update:entry` API (`updateData`). The patch is merged
   * into the entry's data, and the result must satisfy this type; otherwise the request is refused. Without it,
   * `update:entry` refuses every data patch for the script.
   *
   * - It only validates. The merged data is stored as-is, not arktype's output, so morphs, defaults and
   *   `onUndeclaredKey('delete')` have no effect. Use `.onUndeclaredKey('reject')` to refuse unknown keys.
   * - Entry data is stored as passthrough JSON, so keep it to JSON values. A stored Date reads back as a Firestore
   *   Timestamp.
   * - All entries share the bot document, so bound the length of strings and arrays here to keep a patch from bloating it.
   * - Writes from server code (`ensure`, `updateNotificationTaskBotEntryDataFactory()`, a step's `updateEntryData()`,
   *   cleanup `updateData`) are not checked against it.
   * - The client can pre-check a patch with `assertNotificationTaskBotEntryDataPatchAllowed()`.
   */
  readonly dataType?: Maybe<Type<unknown>>;
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
  const groupsByKey = new Map<NotificationTaskBotScriptGroupKey, NotificationTaskBotScriptGroup>();

  configs.forEach((x) => {
    const { scriptType, group, allowOwnerOptOut } = x;

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
  });

  return arrayToObject(configs, {
    readKey: (x) => x.scriptType,
    throwOnDuplicateKey: (scriptType) => new Error(`notificationTaskBotScriptConfigRecord(): duplicate NotificationTaskBotScriptType in record: ${scriptType}`)
  });
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
 * Built on {@link typedConfigRegistry}.
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
  const registry = typedConfigRegistry<NotificationTaskBotScriptConfig, NotificationTaskBotScriptType>({ configs: appNotificationTaskBotScriptConfigRecord, defaultConfigForType: (scriptType) => ({ scriptType }) });
  const optOutGroupKeysByScriptType = new Map<NotificationTaskBotScriptType, NotificationTaskBotScriptGroupKey>();
  const optOutGroupsByKey = new Map<NotificationTaskBotScriptGroupKey, NotificationTaskBotScriptGroup>();

  registry.getAllKnownConfigs().forEach((config) => {
    const { group } = config;

    if (config.allowOwnerOptOut && group != null) {
      optOutGroupKeysByScriptType.set(config.scriptType, group.key);
      optOutGroupsByKey.set(group.key, group);
    }
  });

  return {
    appNotificationTaskBotScriptConfigRecord,
    configForScriptType: registry.configForType,
    registeredConfigForScriptType: registry.registeredConfigForType,
    getAllKnownScriptTypes: registry.getAllKnownTypes,
    getAllKnownScriptConfigs: registry.getAllKnownConfigs,
    optOutGroupKeyForScriptType(scriptType: NotificationTaskBotScriptType) {
      return optOutGroupKeysByScriptType.get(scriptType);
    },
    optOutGroupForKey(groupKey: NotificationTaskBotScriptGroupKey) {
      return optOutGroupsByKey.get(groupKey);
    }
  };
}
