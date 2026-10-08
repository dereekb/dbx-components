import { toJsDate } from '@dereekb/date';
import {
  DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY,
  NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY,
  NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS,
  NotificationBoxRecipientFlag,
  NotificationSendType,
  compareNotificationTemplateTypeInfoGroups,
  isNotificationDeliveryMethodEnabledByDefault,
  notificationBoxIdForModel,
  notificationBoxIdentity,
  notificationIdentity,
  notificationSettingsCellStates,
  notificationSettingsListItemValues,
  notificationTemplateTypeInfoUserConfigurableDeliveryMethods,
  notificationUserIdentity,
  readNotificationDeliveryMethodFlag,
  type FirestoreModelKey,
  type Notification,
  type NotificationBoxRecipientTemplateConfigRecord,
  type NotificationDeliveryMethod,
  type NotificationSettingsListItemValue,
  type NotificationTemplateType,
  type NotificationUser
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliNotificationManifest, type CliNotificationManifestTemplate } from '../manifest/types';
import { CliError } from '../util/output';
import { type CliNotificationConfig, DEFAULT_CLI_NOTIFICATION_COMMAND_NAME, DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME, cliNotificationDeliveryMethods } from './notification.config';

// MARK: Shared
/**
 * Label for a {@link NotificationBoxRecipientFlag}.
 */
export type CliNotificationRecipientFlagLabel = 'enabled' | 'disabled' | 'opt-out';

/**
 * Returns the label of a recipient flag (`f`), or undefined when unset.
 *
 * @param flag - The recipient flag.
 * @returns The label.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliNotificationRecipientFlagLabel(flag: Maybe<NotificationBoxRecipientFlag>): Maybe<CliNotificationRecipientFlagLabel> {
  let result: Maybe<CliNotificationRecipientFlagLabel>;

  switch (flag) {
    case NotificationBoxRecipientFlag.ENABLED:
      result = 'enabled';
      break;
    case NotificationBoxRecipientFlag.DISABLED:
      result = 'disabled';
      break;
    case NotificationBoxRecipientFlag.OPT_OUT:
      result = 'opt-out';
      break;
    default:
      result = undefined;
      break;
  }

  return result;
}

function readCliNotificationDate(value: unknown): Maybe<Date> {
  let result: Maybe<Date>;

  if (value instanceof Date) {
    result = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    result = toJsDate(value);
  }

  return result;
}

// MARK: Types
/**
 * Why a template type is hidden from the user settings.
 */
export type CliNotificationTypeHiddenReason = 'hideFromUserSettings' | 'hiddenTemplateTypes';

/**
 * One template type in a {@link CliNotificationTypesView}.
 */
export interface CliNotificationTypeView {
  readonly type: NotificationTemplateType;
  readonly name: string;
  readonly description?: Maybe<string>;
  /**
   * Name of the group the type is listed under.
   */
  readonly group: string;
  /**
   * Model type of the type's notification model, i.e. the model whose NotificationBox the notification is sent through.
   */
  readonly notificationModel: string;
  /**
   * Model type of the type's target model, when it has one.
   */
  readonly targetModel?: Maybe<string>;
  /**
   * Delivery methods the user can configure for the type, among the shown columns.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  /**
   * What each configurable method resolves to when the user has not set it.
   */
  readonly defaults: Partial<Record<NotificationDeliveryMethod, boolean>>;
  /**
   * Only recipients that explicitly enabled the type receive it.
   */
  readonly onlySendToExplicitlyEnabledRecipients?: Maybe<boolean>;
  /**
   * Only recipients that explicitly enabled texts for the type are texted. Texts are opt-in unless this is `false`.
   */
  readonly onlyTextExplicitlyEnabledRecipients?: Maybe<boolean>;
  /**
   * Delivery methods that are always on for the type, among the shown columns. Set only when the type forces a method.
   */
  readonly forcedDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Set when the type is hidden from the user settings. Only listed with `--all` or an explicit type lookup.
   */
  readonly hidden?: Maybe<CliNotificationTypeHiddenReason>;
  /**
   * Group key. Expanded only.
   */
  readonly groupKey?: Maybe<string>;
  /**
   * All delivery methods the type declares as configurable, including hidden columns. Expanded only.
   */
  readonly userConfigurableDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * The template's entry in the generated notification manifest. Expanded only.
   */
  readonly template?: Maybe<CliNotificationManifestTemplate>;
}

/**
 * View model of `notification types`.
 */
export interface CliNotificationTypesView {
  /**
   * Delivery method columns, in order.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  readonly types: CliNotificationTypeView[];
  /**
   * Number of hidden types left out of {@link types}. Pass `--all` to include them.
   */
  readonly hiddenCount: number;
}

/**
 * Input for {@link notificationTypesView}.
 */
export interface NotificationTypesViewInput {
  readonly config: CliNotificationConfig;
  /**
   * Only show this type. A hidden type is shown when looked up explicitly.
   */
  readonly type?: Maybe<NotificationTemplateType>;
  /**
   * Include the hidden types.
   */
  readonly all?: Maybe<boolean>;
  readonly expanded?: Maybe<boolean>;
}

/**
 * Builds the `notification types` view model from the app's template type info record, using the same list logic as the settings UI.
 *
 * @param input - The config and options.
 * @returns The view model, sorted by group then name.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationTypesView(input: NotificationTypesViewInput): CliNotificationTypesView {
  const { config, type, expanded } = input;
  const record = config.templateTypeInfoRecord;
  const deliveryMethods = cliNotificationDeliveryMethods(config);
  const typeInfos = Object.values(record);
  const listInput = { deliveryMethods, fallbackGroupBy: config.fallbackGroupBy, defaultGroup: config.defaultGroup };
  const visible = notificationSettingsListItemValues({ ...listInput, typeInfos, hiddenTemplateTypes: config.hiddenTemplateTypes });
  const visibleTypes = new Set(visible.map((x) => x.type));
  const everything = notificationSettingsListItemValues({ ...listInput, typeInfos: typeInfos.map((x) => ({ ...x, hideFromUserSettings: false })) });
  const showHidden = input.all === true || type != null;
  const items = (showHidden ? everything : visible).filter((x) => type == null || x.type === type).sort((a, b) => compareNotificationTemplateTypeInfoGroups(a.group, b.group));
  const templates = new Map((config.manifest?.templates ?? []).map((x) => [x.type, x]));

  const types = items.map((item) => {
    const info = record[item.type] ?? item.info;
    const isHidden = !visibleTypes.has(item.type);
    const defaults: Partial<Record<NotificationDeliveryMethod, boolean>> = {};
    item.deliveryMethods.forEach((method) => (defaults[method] = isNotificationDeliveryMethodEnabledByDefault(method, info)));

    const view: CliNotificationTypeView = {
      type: item.type,
      name: item.name,
      description: item.description,
      group: item.group.name,
      notificationModel: info.notificationModelIdentity.modelType,
      ...(info.targetModelIdentity ? { targetModel: info.targetModelIdentity.modelType } : {}),
      deliveryMethods: item.deliveryMethods,
      defaults,
      ...(info.onlySendToExplicitlyEnabledRecipients == null ? {} : { onlySendToExplicitlyEnabledRecipients: info.onlySendToExplicitlyEnabledRecipients }),
      ...(info.onlyTextExplicitlyEnabledRecipients == null ? {} : { onlyTextExplicitlyEnabledRecipients: info.onlyTextExplicitlyEnabledRecipients }),
      ...(item.forcedDeliveryMethods?.length ? { forcedDeliveryMethods: item.forcedDeliveryMethods } : {}),
      ...(isHidden ? { hidden: info.hideFromUserSettings ? 'hideFromUserSettings' : 'hiddenTemplateTypes' } : {}),
      ...(expanded ? { groupKey: item.group.key, userConfigurableDeliveryMethods: notificationTemplateTypeInfoUserConfigurableDeliveryMethods(info), template: templates.get(item.type) } : {})
    };

    return view;
  });

  return { deliveryMethods, types, hiddenCount: showHidden ? 0 : everything.length - visible.length };
}

// MARK: Task Types
/**
 * One task type in a {@link CliNotificationTaskTypesView}.
 */
export interface CliNotificationTaskTypeView {
  readonly type: string;
  readonly symbolName: string;
  /**
   * The task's checkpoint flow, in order.
   */
  readonly checkpoints: readonly string[];
  /**
   * Whether the API registers a handler for the task type.
   */
  readonly hasHandler: boolean;
  /**
   * Expanded only.
   */
  readonly dataInterfaceName?: Maybe<string>;
  /**
   * Expanded only.
   */
  readonly handlerFlowStepCount?: Maybe<number>;
  /**
   * Expanded only.
   */
  readonly sourceFile?: Maybe<string>;
}

/**
 * View model of `notification task-types`.
 */
export interface CliNotificationTaskTypesView {
  readonly tasks: CliNotificationTaskTypeView[];
}

/**
 * Input for {@link notificationTaskTypesView}.
 */
export interface NotificationTaskTypesViewInput {
  readonly manifest: CliNotificationManifest;
  /**
   * Only show this task type.
   */
  readonly type?: Maybe<string>;
  readonly expanded?: Maybe<boolean>;
}

/**
 * Builds the `notification task-types` view model from the generated notification manifest.
 *
 * @param input - The manifest and options.
 * @returns The view model, sorted by type.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationTaskTypesView(input: NotificationTaskTypesViewInput): CliNotificationTaskTypesView {
  const { manifest, type, expanded } = input;
  const tasks = manifest.tasks
    .filter((x) => type == null || x.type === type)
    .map((x) => {
      const view: CliNotificationTaskTypeView = {
        type: x.type,
        symbolName: x.symbolName,
        checkpoints: x.checkpoints,
        hasHandler: x.hasHandler,
        ...(expanded ? { dataInterfaceName: x.dataInterfaceName, handlerFlowStepCount: x.handlerFlowStepCount, sourceFile: x.sourceFile } : {})
      };

      return view;
    })
    .sort((a, b) => a.type.localeCompare(b.type));

  return { tasks };
}

// MARK: User Settings
/**
 * Where a settings cell's effective value comes from:
 * - `explicit`: the user set the cell.
 * - `master`: the user set the type's master toggle (`sd`).
 * - `default`: the type's default.
 * - `disabled`: the method is turned off account-wide (`gc.dm`).
 * - `forced`: the method is always on for the type (`forcedDeliveryMethods`), so the user's cells for the type are skipped.
 * - `unavailable`: the user cannot configure the method for the type, so the type's default applies.
 */
export type CliNotificationSettingsCellSource = 'explicit' | 'master' | 'default' | 'disabled' | 'forced' | 'unavailable';

/**
 * One template type × delivery method cell of the account-level (`gc`) settings.
 */
export interface CliNotificationSettingsCellView {
  readonly available: boolean;
  /**
   * The saved value. Null means "Default".
   */
  readonly value: Maybe<boolean>;
  /**
   * What the cell resolves to when it has no value.
   */
  readonly defaultValue: boolean;
  /**
   * Whether the method is turned off account-wide.
   */
  readonly disabled: boolean;
  /**
   * The resolved account-level value.
   */
  readonly effective: boolean;
  readonly source: CliNotificationSettingsCellSource;
}

/**
 * One template type row of a {@link CliNotificationUserSettingsView}.
 */
export interface CliNotificationSettingsRowView {
  readonly type: NotificationTemplateType;
  readonly name: string;
  readonly group: string;
  readonly cells: Partial<Record<NotificationDeliveryMethod, CliNotificationSettingsCellView>>;
}

/**
 * The account-level header of a {@link CliNotificationUserSettingsView}, read from `gc` and `tso`.
 */
export interface CliNotificationAccountView {
  /**
   * The global recipient flag (`gc.f`).
   */
  readonly flag?: Maybe<CliNotificationRecipientFlagLabel>;
  /**
   * Delivery methods turned off account-wide (`gc.dm`).
   */
  readonly disabledDeliveryMethods: NotificationDeliveryMethod[];
  /**
   * The email address override (`gc.e`).
   */
  readonly email?: Maybe<string>;
  /**
   * The phone number for texts (`gc.t`).
   */
  readonly phone?: Maybe<string>;
  /**
   * Phone numbers that replied STOP (`tso`). Texts to these numbers are suppressed.
   */
  readonly textStoppedNumbers: string[];
}

/**
 * One cell of a NotificationBox's settings. Expanded only.
 */
export interface CliNotificationBoxSettingsCellView {
  readonly value: Maybe<boolean>;
  /**
   * The account-level (`gc`) value that decides the cell at send time, when set.
   */
  readonly overriddenBy?: Maybe<boolean>;
}

/**
 * One NotificationBox config (`bc` entry) of a {@link CliNotificationUserSettingsView}. Expanded only.
 */
export interface CliNotificationBoxSettingsView {
  readonly nb: string;
  readonly flag?: Maybe<CliNotificationRecipientFlagLabel>;
  /**
   * The user was removed from the box (`rm`).
   */
  readonly removed: boolean;
  readonly needsSync: boolean;
  /**
   * The box's per-type cells, for the types the box config sets.
   */
  readonly types: Record<NotificationTemplateType, Partial<Record<NotificationDeliveryMethod, CliNotificationBoxSettingsCellView>>>;
}

/**
 * One ready-to-run example of changing a setting with `model notificationUser update`.
 */
export interface CliNotificationSettingsChangeExample {
  readonly description: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly command: string;
}

/**
 * The "how to change" block of an expanded {@link CliNotificationUserSettingsView}.
 */
export interface CliNotificationSettingsHowToChange {
  readonly command: string;
  readonly notes: string[];
  readonly examples: CliNotificationSettingsChangeExample[];
}

/**
 * View model of `model notificationUser settings`.
 */
export interface CliNotificationUserSettingsView {
  readonly key: FirestoreModelKey;
  readonly uid: string;
  /**
   * Whether the NotificationUser exists. A user without one gets every type's default.
   */
  readonly exists: boolean;
  readonly account: CliNotificationAccountView;
  /**
   * Delivery method columns, in order.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  readonly types: CliNotificationSettingsRowView[];
  /**
   * The direct config (`dc`) cells, keyed by type. Expanded only.
   */
  readonly directConfig?: Maybe<NotificationBoxRecipientTemplateConfigRecord>;
  /**
   * The NotificationBox configs (`bc`). Expanded only.
   */
  readonly boxes?: Maybe<CliNotificationBoxSettingsView[]>;
  /**
   * NotificationBoxes excluded from sends (`x`). Expanded only.
   */
  readonly excludedBoxes?: Maybe<string[]>;
  /**
   * NotificationBoxes the user is a recipient of (`b`). Expanded only.
   */
  readonly boxIds?: Maybe<string[]>;
  /**
   * Whether the configs still need to sync to the boxes (`ns`). Expanded only.
   */
  readonly needsSync?: Maybe<boolean>;
  /**
   * The latest delivery health check (`hc`). Expanded only.
   */
  readonly healthCheck?: Maybe<unknown>;
  /**
   * Ready payloads for `model notificationUser update`. Expanded only.
   */
  readonly howToChange?: Maybe<CliNotificationSettingsHowToChange>;
}

/**
 * Input for {@link notificationUserSettingsView}.
 */
export interface NotificationUserSettingsViewInput {
  readonly config: CliNotificationConfig;
  /**
   * The NotificationUser key (`nu/<uid>`).
   */
  readonly key: FirestoreModelKey;
  /**
   * The NotificationUser, or null when it does not exist.
   */
  readonly notificationUser: Maybe<Partial<NotificationUser>>;
  /**
   * The CLI's name, used in the update hints.
   */
  readonly cliName: string;
  readonly expanded?: Maybe<boolean>;
}

/**
 * Builds the `model notificationUser settings` view model: the account-level (`gc`) settings matrix the settings UI shows, resolved to
 * each cell's effective value.
 *
 * @param input - The config, the NotificationUser and options.
 * @returns The view model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationUserSettingsView(input: NotificationUserSettingsViewInput): CliNotificationUserSettingsView {
  const { config, key, notificationUser, cliName, expanded } = input;
  const deliveryMethods = cliNotificationDeliveryMethods(config);
  const items = notificationSettingsListItemValues({ typeInfos: Object.values(config.templateTypeInfoRecord), deliveryMethods, hiddenTemplateTypes: config.hiddenTemplateTypes, fallbackGroupBy: config.fallbackGroupBy, defaultGroup: config.defaultGroup }).sort((a, b) =>
    compareNotificationTemplateTypeInfoGroups(a.group, b.group)
  );
  const gc = notificationUser?.gc;
  const cellStates = notificationSettingsCellStates({ items, deliveryMethods, gc });
  const uid = notificationUser?.uid ?? key.split('/')[1] ?? key;

  const types = items.map((item) => {
    const row = cellStates[item.type] ?? {};
    const hasMaster = gc?.c?.[item.type]?.sd != null;
    const cells: Partial<Record<NotificationDeliveryMethod, CliNotificationSettingsCellView>> = {};

    deliveryMethods.forEach((method) => {
      const state = row[method];

      if (state) {
        let source: CliNotificationSettingsCellSource;
        let effective: boolean;

        if (state.disabled) {
          source = 'disabled';
          effective = false;
        } else if (state.forced) {
          source = 'forced';
          effective = true;
        } else if (!state.available) {
          source = 'unavailable';
          effective = state.defaultValue;
        } else if (state.value == null) {
          source = hasMaster ? 'master' : 'default';
          effective = state.defaultValue;
        } else {
          source = 'explicit';
          effective = state.value;
        }

        cells[method] = { available: state.available, value: state.value ?? null, defaultValue: state.defaultValue, disabled: state.disabled, effective, source };
      }
    });

    const view: CliNotificationSettingsRowView = { type: item.type, name: item.name, group: item.group.name, cells };
    return view;
  });

  const account: CliNotificationAccountView = {
    flag: cliNotificationRecipientFlagLabel(gc?.f),
    disabledDeliveryMethods: gc?.dm ?? [],
    email: gc?.e,
    phone: gc?.t,
    textStoppedNumbers: notificationUser?.tso ?? []
  };

  let view: CliNotificationUserSettingsView = { key, uid, exists: notificationUser != null, account, deliveryMethods, types };

  if (expanded) {
    view = {
      ...view,
      directConfig: notificationUser?.dc?.c ?? {},
      boxes: (notificationUser?.bc ?? []).map((bc) => notificationBoxSettingsView({ bc, gc, items, deliveryMethods })),
      excludedBoxes: notificationUser?.x ?? [],
      boxIds: notificationUser?.b ?? [],
      needsSync: notificationUser?.ns ?? false,
      healthCheck: notificationUser?.hc ?? null,
      howToChange: notificationSettingsHowToChange({ config, key, cliName, items, gc, bc: notificationUser?.bc })
    };
  }

  return view;
}

function notificationBoxSettingsView(input: { readonly bc: NonNullable<NotificationUser['bc']>[number]; readonly gc: Maybe<NotificationUser['gc']>; readonly items: NotificationSettingsListItemValue[]; readonly deliveryMethods: NotificationDeliveryMethod[] }): CliNotificationBoxSettingsView {
  const { bc, gc, items, deliveryMethods } = input;
  const configuredTypes = new Set(Object.keys(bc.c ?? {}));
  const boxItems = items.filter((x) => configuredTypes.has(x.type));
  const states = notificationSettingsCellStates({ items: boxItems, deliveryMethods, gc, boxConfig: bc });
  const types: CliNotificationBoxSettingsView['types'] = {};

  boxItems.forEach((item) => {
    const cells: Partial<Record<NotificationDeliveryMethod, CliNotificationBoxSettingsCellView>> = {};

    item.deliveryMethods.forEach((method) => {
      const state = states[item.type]?.[method];
      cells[method] = { value: readNotificationDeliveryMethodFlag(bc.c?.[item.type], method) ?? null, ...(state?.override ? { overriddenBy: state.override.value } : {}) };
    });

    types[item.type] = cells;
  });

  return { nb: bc.nb, flag: cliNotificationRecipientFlagLabel(bc.f), removed: bc.rm === true, needsSync: bc.ns === true, types };
}

function notificationSettingsHowToChange(input: {
  readonly config: CliNotificationConfig;
  readonly key: FirestoreModelKey;
  readonly cliName: string;
  readonly items: NotificationSettingsListItemValue[];
  readonly gc: Maybe<NotificationUser['gc']>;
  readonly bc: Maybe<NotificationUser['bc']>;
}): CliNotificationSettingsHowToChange {
  const { config, key, cliName, items, gc, bc } = input;
  const command = `${cliName} ${config.modelCommandName ?? DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME} ${notificationUserIdentity.modelType} update`;
  const exampleItem = items.find((x) => x.deliveryMethods.length > 0);
  const exampleType = exampleItem?.type ?? '<type>';
  const exampleMethod = exampleItem?.deliveryMethods[0];
  const exampleConfigKey = exampleMethod ? NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY[exampleMethod] : 'se';
  const disableMethod = items.flatMap((x) => [...x.deliveryMethods, ...(x.forcedDeliveryMethods ?? [])]).find((x) => !(gc?.dm ?? []).includes(x));
  const hasForced = items.some((x) => x.forcedDeliveryMethods?.length);
  const exampleBox = bc?.[0]?.nb ?? '<notificationBoxId>';

  const example = (description: string, data: Record<string, unknown>): CliNotificationSettingsChangeExample => ({ description, data, command: `${command} --data '${JSON.stringify(data)}'` });

  const examples: CliNotificationSettingsChangeExample[] = [
    example(`Turn a cell off (${exampleType} · ${exampleConfigKey}). Use true to turn it on.`, { key, gc: { configs: [{ type: exampleType, [exampleConfigKey]: false }] } }),
    example(`Reset a cell to Default (${exampleType} · ${exampleConfigKey}).`, { key, gc: { configs: [{ type: exampleType, [exampleConfigKey]: null }] } }),
    example(`Turn a delivery method off account-wide (dm replaces the whole list).`, { key, gc: { dm: [...(gc?.dm ?? []), disableMethod ?? '<method>'] } }),
    example(`Opt out of a NotificationBox (${exampleBox}).`, { key, bc: [{ nb: exampleBox, f: NotificationBoxRecipientFlag.OPT_OUT }], resync: true })
  ];

  const notes = [
    'Account-level settings (gc) take priority over NotificationBox (bc) and notification-level config. A Default (null) cell lets the box and notification-level config apply.',
    'A method in gc.dm is off for every type, whatever the cell says.',
    ...(hasForced ? ['A forced (always on) cell cannot be changed: the type ignores its gc, bc and dc cells for that method. Only gc.dm, opting out, or opting out of the box turns it off.'] : []),
    `Per-method config keys: ${Object.entries(NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY)
      .map(([method, configKey]) => `${configKey} (${method})`)
      .join(', ')}; sd sets every method of a type at once.`,
    `Run \`${cliName} ${config.commandName ?? DEFAULT_CLI_NOTIFICATION_COMMAND_NAME} types\` for the catalog of types and their defaults.`
  ];

  return { command, notes, examples };
}

// MARK: Tasks
/**
 * State of a notification task:
 * - `done`: finished and awaiting cleanup.
 * - `ready`: its send time has passed, so it runs on the next sweep.
 * - `scheduled`: its send time is in the future.
 */
export type CliNotificationTaskState = 'done' | 'ready' | 'scheduled';

/**
 * State filter of `model notification tasks`. `pending` matches `ready` and `scheduled`.
 */
export type CliNotificationTaskStateFilter = 'pending' | 'done' | 'all';

/**
 * Values of {@link CliNotificationTaskStateFilter}.
 */
export const CLI_NOTIFICATION_TASK_STATE_FILTER_VALUES: readonly CliNotificationTaskStateFilter[] = ['pending', 'done', 'all'];

/**
 * View model of one notification task.
 */
export interface CliNotificationTaskView {
  readonly key: FirestoreModelKey;
  /**
   * The task type (`n.t`).
   */
  readonly type?: Maybe<string>;
  readonly state: CliNotificationTaskState;
  /**
   * When the task runs next (`sat`).
   */
  readonly sendAt?: Maybe<Date>;
  /**
   * When the task was created (`cat`).
   */
  readonly createdAt?: Maybe<Date>;
  /**
   * Failed send attempts (`a`).
   */
  readonly attempts: number;
  readonly maxAttempts: number;
  /**
   * Attempts on the current checkpoint (`at`).
   */
  readonly checkpointAttempts?: Maybe<number>;
  /**
   * Completed checkpoints (`tpr`).
   */
  readonly completedCheckpoints: string[];
  /**
   * The checkpoints of the task's flow not yet completed. Only set when the type is in the manifest.
   */
  readonly remainingCheckpoints?: Maybe<string[]>;
  readonly nextCheckpoint?: Maybe<string>;
  /**
   * Whether the task is unique (`ut`).
   */
  readonly unique: boolean;
  /**
   * The task's model (`n.m`).
   */
  readonly model?: Maybe<string>;
  /**
   * Whether the notification is a task (`st` is {@link NotificationSendType.TASK_NOTIFICATION}).
   */
  readonly isTask: boolean;
  /**
   * Whether the type is in the app's notification manifest. Unset when there is no manifest.
   */
  readonly knownType?: Maybe<boolean>;
  readonly warnings: string[];
  /**
   * The task's full checkpoint flow. Expanded only.
   */
  readonly checkpoints?: Maybe<readonly string[]>;
  /**
   * The uid that created the task (`n.cb`). Expanded only.
   */
  readonly createdBy?: Maybe<string>;
  /**
   * The task's data (`n.d`). Expanded only.
   */
  readonly data?: Maybe<unknown>;
}

/**
 * Input for {@link notificationTaskView}.
 */
export interface NotificationTaskViewInput {
  readonly key: FirestoreModelKey;
  /**
   * The notification, read from Firestore (dates as `Date`) or the API (dates as ISO strings).
   */
  readonly notification: Partial<Notification>;
  readonly manifest?: Maybe<CliNotificationManifest>;
  /**
   * The time `ready` is measured against. Defaults to now.
   */
  readonly now?: Maybe<Date>;
  readonly expanded?: Maybe<boolean>;
}

/**
 * Builds the view model of one notification task: its state, attempts and checkpoint progress against the manifest flow.
 *
 * @param input - The notification and options.
 * @returns The view model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationTaskView(input: NotificationTaskViewInput): CliNotificationTaskView {
  const { key, notification, manifest, expanded } = input;
  const now = input.now ?? new Date();
  const sendAt = readCliNotificationDate(notification.sat);
  const createdAt = readCliNotificationDate(notification.cat);
  const type = notification.n?.t;
  const isTask = notification.st === NotificationSendType.TASK_NOTIFICATION;
  const task = manifest?.tasks.find((x) => x.type === type);
  const completedCheckpoints = notification.tpr ?? [];
  const attempts = notification.a ?? 0;
  const warnings: string[] = [];

  let state: CliNotificationTaskState;

  if (notification.d) {
    state = 'done';
  } else if (sendAt != null && sendAt.getTime() <= now.getTime()) {
    state = 'ready';
  } else {
    state = 'scheduled';
  }

  if (!isTask) {
    warnings.push(`Not a task notification (st=${notification.st ?? 'unset'}).`);
  }

  if (manifest != null && task == null && isTask) {
    warnings.push(`Type ${type ?? '<unset>'} is not in the app's notification manifest. Framework task types (e.g. SFP, FSPS) are expected here.`);
  }

  if (attempts >= NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS && !notification.d) {
    warnings.push(`Reached the maximum of ${NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS} send attempts.`);
  }

  const completed = new Set(completedCheckpoints);
  const remainingCheckpoints = task?.checkpoints.filter((x) => !completed.has(x));

  return {
    key,
    type,
    state,
    sendAt,
    createdAt,
    attempts,
    maxAttempts: NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS,
    checkpointAttempts: notification.at ?? null,
    completedCheckpoints,
    ...(remainingCheckpoints ? { remainingCheckpoints, nextCheckpoint: remainingCheckpoints[0] ?? null } : {}),
    unique: notification.ut === true,
    model: notification.n?.m,
    isTask,
    ...(manifest == null ? {} : { knownType: task != null }),
    warnings,
    ...(expanded ? { checkpoints: task?.checkpoints ?? null, createdBy: notification.n?.cb ?? null, data: notification.n?.d ?? null } : {})
  };
}

/**
 * One notification read from a NotificationBox, before it becomes a {@link CliNotificationTaskView}.
 */
export interface CliNotificationTaskSource {
  readonly key: FirestoreModelKey;
  readonly notification: Partial<Notification>;
}

/**
 * View model of `model notification tasks`.
 */
export interface CliNotificationTasksView {
  /**
   * The NotificationBox key that was listed.
   */
  readonly box: FirestoreModelKey;
  /**
   * Number of notifications read, before filtering.
   */
  readonly read: number;
  /**
   * Number of read notifications that are not tasks.
   */
  readonly skippedNonTasks: number;
  readonly tasks: CliNotificationTaskView[];
}

/**
 * Input for {@link notificationTasksView}.
 */
export interface NotificationTasksViewInput {
  readonly box: FirestoreModelKey;
  readonly notifications: readonly CliNotificationTaskSource[];
  readonly manifest?: Maybe<CliNotificationManifest>;
  /**
   * Only include this task type.
   */
  readonly type?: Maybe<string>;
  /**
   * Defaults to `all`.
   */
  readonly state?: Maybe<CliNotificationTaskStateFilter>;
  readonly now?: Maybe<Date>;
  readonly expanded?: Maybe<boolean>;
}

/**
 * Builds the `model notification tasks` view model: the box's task notifications, filtered by type and state.
 *
 * @param input - The box, its notifications and the filters.
 * @returns The view model, in the order read.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationTasksView(input: NotificationTasksViewInput): CliNotificationTasksView {
  const { box, notifications, manifest, type, now, expanded } = input;
  const stateFilter = input.state ?? 'all';
  const taskSources = notifications.filter((x) => x.notification.st === NotificationSendType.TASK_NOTIFICATION);

  const tasks = taskSources
    .filter((x) => type == null || x.notification.n?.t === type)
    .map((x) => notificationTaskView({ key: x.key, notification: x.notification, manifest, now, expanded }))
    .filter((x) => stateFilter === 'all' || (stateFilter === 'done' ? x.state === 'done' : x.state !== 'done'));

  return { box, read: notifications.length, skippedNonTasks: notifications.length - taskSources.length, tasks };
}

// MARK: Keys
/**
 * Resolves the `[box]` argument of `model notification tasks` to a NotificationBox key:
 * - A box key, `nb/<id>`, is used as-is.
 * - Another model key, e.g. `pr/<uid>`, resolves to that model's box, `nb/pr_<uid>`.
 * - A bare id resolves to `nb/<id>`.
 * - No argument resolves to the framework task box, the box of {@link DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY}.
 *
 * @param box - The raw argument.
 * @returns The NotificationBox key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliNotificationBoxKey(box: Maybe<string>): FirestoreModelKey {
  const value = box?.trim() || DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY;
  const boxPrefix = `${notificationBoxIdentity.collectionName}/`;
  let id: string;

  if (value.startsWith(boxPrefix) && value.split('/').length === 2) {
    id = value.slice(boxPrefix.length);
  } else if (value.includes('/')) {
    id = notificationBoxIdForModel(value);
  } else {
    id = value;
  }

  return `${boxPrefix}${id}`;
}

/**
 * Asserts that `key` is a notification key, `nb/<boxId>/nbn/<id>`.
 *
 * @param key - The key to check.
 * @throws {CliError} `INVALID_ARGUMENT` when the key has another shape.
 */
export function assertCliNotificationKey(key: string): void {
  const segments = key.split('/');

  if (segments.length !== 4 || segments[0] !== notificationBoxIdentity.collectionName || segments[2] !== notificationIdentity.collectionName || segments.some((x) => x.length === 0)) {
    throw new CliError({
      message: `'${key}' is not a notification key.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Pass the full key, ${notificationBoxIdentity.collectionName}/<boxId>/${notificationIdentity.collectionName}/<id>. List a box's tasks with \`model notification tasks [box]\`.`
    });
  }
}
