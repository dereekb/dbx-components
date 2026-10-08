import {
  DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS,
  effectiveNotificationBoxRecipientTemplateConfig,
  type FirestoreModelKey,
  inferNotificationBoxRelatedModelKey,
  isNotificationDeliveryMethodEnabledByDefault,
  type NotificationBoxId,
  notificationBoxIdForModel,
  NotificationBoxRecipientFlag,
  type NotificationBoxRecipientTemplateConfigRecord,
  NotificationDeliveryMethod,
  type NotificationBoxRecipientTemplateConfig,
  type NotificationBoxRecipientTemplateConfigArrayEntryParam,
  type NotificationBoxRecipientTemplateConfigDeliveryMethodKey,
  NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY,
  type NotificationDeliveryMethodMap,
  type NotificationTemplateType,
  type NotificationTemplateTypeInfo,
  type NotificationTemplateTypeInfoGroup,
  type NotificationTemplateTypeInfoGroupKey,
  notificationTemplateTypeInfoUserConfigurableDeliveryMethods,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  type NotificationUserNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag,
  toCanonicalNotificationDeliveryMethods,
  type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams,
  type UpdateNotificationUserNotificationBoxRecipientParams,
  type UpdateNotificationUserParams
} from '@dereekb/firebase';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { compareNotificationTemplateTypeInfoGroups, type DbxFirebaseNotificationSettingsCellOverride, type DbxFirebaseNotificationSettingsCellStates, type DbxFirebaseNotificationSettingsListItemValue, type DbxFirebaseNotificationSettingsRowCellStates } from '../component/notification.settings.list';

/**
 * Default text message disclosure shown beside the text message settings.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE = 'Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.';

/**
 * Default message shown while texts are locked because the texting number replied STOP.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_STOPPED_MESSAGE = 'Your texting number replied STOP, so text messages are off. Reply START to any of our texts to turn them back on, or save a different number.';

/**
 * Delivery methods that get an account-wide on/off switch by default.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS: NotificationDeliveryMethod[] = [NotificationDeliveryMethod.TEXT];

/**
 * Group for template types that have no group, when not grouping by notification model.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP: NotificationTemplateTypeInfoGroup = { key: '_', name: 'Notifications' };

/**
 * How to group template types that have no group.
 *
 * - `none` — use the default group
 * - `notificationModel` — group by the model the notification is attached to
 */
export type DbxFirebaseNotificationSettingsFallbackGroupBy = 'none' | 'notificationModel';

/**
 * Where a user's per-template-type notification settings live, which decides how the settings for one NotificationBox work.
 *
 * The user's global settings (`gc`) are an override, not a default: wherever they set a delivery method for a template type, that value is
 * used in every box, and the box's own setting for that method is ignored. Per-type settings made in both places rarely do what the user
 * expects, so an app picks one place for them:
 *
 * - `global` — the per-type settings are the global settings. The settings for a box show an on/off switch for the whole box, followed by the
 *   global settings for the box's template types, which apply to every box of that kind. Turning a box off stops all of its notifications,
 *   whatever the global settings say. This is the default, and suits most apps.
 * - `perBox` — the per-type settings live on each box (the user's `bc` entry for it). The settings for a box show the on/off switch and the
 *   box's own settings. A global setting for the same template type still overrides them, and those cells show as overridden, so keep the
 *   per-box template types off the global settings page with `groups`, `templateTypes` or `hiddenTemplateTypes`.
 *
 * In `global` mode the per-type settings on a box entry are not shown, but they still decide whatever the global settings leave unset. An app in
 * `global` mode should not set template configs on its box recipients.
 */
export type DbxFirebaseNotificationBoxSettingsMode = 'global' | 'perBox';

/**
 * The default {@link DbxFirebaseNotificationBoxSettingsMode}.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE: DbxFirebaseNotificationBoxSettingsMode = 'global';

/**
 * App-level configuration for the notification user settings UI.
 *
 * Provided via the `userSettings` key of `provideDbxFirebaseNotifications()`.
 */
export abstract class DbxFirebaseNotificationUserSettingsConfig {
  /**
   * Delivery method columns, in order. Defaults to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}.
   */
  abstract readonly deliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Delivery methods to hide from the settings, such as texts in an app that does not send them. Applies after {@link deliveryMethods}.
   *
   * A hidden method has no column, no account-wide switch, and, for texts, no phone number for texts.
   */
  abstract readonly hiddenDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Delivery methods that get an account-wide on/off switch. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS}.
   *
   * Only the methods that are also columns get a switch.
   */
  abstract readonly switchableDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Disclosure shown beside the text message settings. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE}.
   */
  abstract readonly textMessageDisclosure?: Maybe<string>;
  /**
   * Message shown while texts are locked because the texting number replied STOP. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_STOPPED_MESSAGE}.
   */
  abstract readonly textStoppedMessage?: Maybe<string>;
  /**
   * Preferred countries for the phone number field, e.g. `['US', 'CA']`.
   */
  abstract readonly phoneNumberPreferredCountries?: Maybe<string[]>;
  /**
   * Groups to show. When {@link groups} or {@link templateTypes} is set, only the template types in these groups or in
   * {@link templateTypes} are shown.
   *
   * Matches the group a type is listed under, including the fallback group of a type with no group.
   */
  abstract readonly groups?: Maybe<NotificationTemplateTypeInfoGroupKey[]>;
  /**
   * Template types to show. When {@link groups} or {@link templateTypes} is set, only these template types and the types in
   * {@link groups} are shown.
   */
  abstract readonly templateTypes?: Maybe<NotificationTemplateType[]>;
  /**
   * Template types to hide from the settings, in addition to types marked `hideFromUserSettings`. Applies after
   * {@link groups} and {@link templateTypes}.
   */
  abstract readonly hiddenTemplateTypes?: Maybe<NotificationTemplateType[]>;
  /**
   * How to group template types that have no group. Defaults to `none`.
   */
  abstract readonly fallbackGroupBy?: Maybe<DbxFirebaseNotificationSettingsFallbackGroupBy>;
  /**
   * Group for template types that have no group. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP}.
   */
  abstract readonly defaultGroup?: Maybe<NotificationTemplateTypeInfoGroup>;
  /**
   * Anchor to the page with all of the user's notification settings, such as the route that shows
   * `dbx-firebase-notification-user-settings`. When set, the notification settings dialog links to it.
   */
  abstract readonly settingsAnchor?: Maybe<ClickableAnchor>;
  /**
   * Where the user's per-template-type settings live, which decides how the settings for a NotificationBox work. Defaults to
   * {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE} (`global`).
   *
   * The global settings override the per-box settings, so an app should pick one place for them. See {@link DbxFirebaseNotificationBoxSettingsMode}.
   */
  abstract readonly notificationBoxSettingsMode?: Maybe<DbxFirebaseNotificationBoxSettingsMode>;
}

// MARK: NotificationBox
/**
 * The NotificationBox whose settings to edit, such as "my settings for this guestbook". Set {@link modelKey}, {@link notificationBoxId}, or both.
 */
export interface DbxFirebaseNotificationUserSettingsNotificationBoxConfig {
  /**
   * Key of the model the box is for, such as a guestbook's key. Decides which template types are shown.
   *
   * Defaults to the model key inferred from {@link notificationBoxId}.
   */
  readonly modelKey?: Maybe<FirestoreModelKey>;
  /**
   * Id of the NotificationBox. Defaults to the box id for {@link modelKey}.
   */
  readonly notificationBoxId?: Maybe<NotificationBoxId>;
  /**
   * What the box's model is called, such as "guestbook". Used in the texts that describe the box.
   */
  readonly modelName?: Maybe<string>;
  /**
   * Plural of {@link modelName}, such as "guestbooks". Defaults to {@link modelName} with an "s" added.
   */
  readonly modelPluralName?: Maybe<string>;
}

/**
 * The resolved NotificationBox to edit the settings for.
 */
export interface DbxFirebaseNotificationUserSettingsNotificationBoxTarget {
  /**
   * Id of the NotificationBox.
   */
  readonly notificationBoxId: NotificationBoxId;
  /**
   * Key of the model the box is for.
   */
  readonly modelKey: FirestoreModelKey;
}

/**
 * Resolves the NotificationBox id and model key from a {@link DbxFirebaseNotificationUserSettingsNotificationBoxConfig}, deriving each from the other when only one is set.
 *
 * @param config - The NotificationBox config.
 * @returns The target, or undefined when neither the model key nor the box id is set.
 */
export function dbxFirebaseNotificationUserSettingsNotificationBoxTarget(config: Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>): Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxTarget> {
  const modelKey = config?.modelKey ?? (config?.notificationBoxId ? inferNotificationBoxRelatedModelKey(config.notificationBoxId) : undefined);
  const notificationBoxId = config?.notificationBoxId ?? (modelKey ? notificationBoxIdForModel(modelKey) : undefined);
  return modelKey && notificationBoxId ? { notificationBoxId, modelKey } : undefined;
}

// MARK: Texts
/**
 * Default hint shown above the global settings (`gc`).
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_HINT = 'Click a setting to switch it between Default, On and Off. Colored icons are your own choices; uncolored icons follow the default for that notification.';

/**
 * Default hint shown above the global settings (`gc`) in `perBox` mode, where they override the settings made for each NotificationBox.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_PER_BOX_MODE_HINT = `${DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_HINT} These settings apply everywhere and take priority over the settings you make in one specific place.`;

/**
 * Default hint shown above a NotificationBox's settings in `perBox` mode, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_HINT = 'Click a setting to switch it between Default, On and Off. These settings only apply here. Grayed-out settings are set by your general settings, which take priority.';

/**
 * Default hint shown above the global settings for a NotificationBox's template types in `global` mode, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SETTINGS_HINT = 'Click a setting to switch it between Default, On and Off. These settings apply everywhere, not only here.';

/**
 * Default hint shown above the global settings while a NotificationBox context is switched off, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_GLOBAL_HINT = 'Click a setting to switch it between Default, On and Off. These settings apply everywhere and take priority over the settings made only here.';

/**
 * Default tooltip of a NotificationBox cell that the global settings override, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION = 'Your general setting for this notification takes priority over this.';

/**
 * Default message shown when the user does not receive a NotificationBox's notifications, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_NOT_RECIPIENT_MESSAGE = 'You do not receive these notifications.';

/**
 * Default notice shown when a NotificationBox turned off its notifications for the user, so they can't turn them back on, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_INACTIVE_RECIPIENT_MESSAGE = 'These notifications are turned off for you here.';

/**
 * Default label of the switch that turns a NotificationBox's notifications on or off, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_LABEL = 'Get notifications from here';

/**
 * Default hint shown while a NotificationBox's switch is off in `global` mode, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SWITCH_OFF_HINT = "You won't get any of these notifications from here. The settings below still apply everywhere else.";

/**
 * Default hint shown while a NotificationBox's switch is off in `perBox` mode, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_OFF_HINT = "You won't get any of these notifications from here, so the settings below have no effect for now.";

/**
 * Default label of the NotificationBox context toggle's option that edits the box's settings, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SCOPE_LABEL = 'Only here';

/**
 * Default label of the NotificationBox context toggle's option that edits the global settings, when the box's model has no name.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_GLOBAL_SCOPE_LABEL = 'Everywhere';

/**
 * Texts that describe the notification settings, for the global settings or for a NotificationBox.
 */
export interface DbxFirebaseNotificationUserSettingsTexts {
  /**
   * Hint shown above the settings.
   */
  readonly hint: string;
  /**
   * Hint shown instead of {@link hint} while a NotificationBox context is switched off. Only set for a targeted box in `perBox` mode.
   */
  readonly globalHint?: Maybe<string>;
  /**
   * Tooltip of a box cell that the global settings override. Only set for a targeted box in `perBox` mode.
   */
  readonly overrideDescription?: Maybe<string>;
  /**
   * Message shown when the user does not receive the box's notifications. Only set when a box is targeted.
   */
  readonly notRecipientMessage?: Maybe<string>;
  /**
   * Notice shown when the box turned its notifications off for the user, so the box switch can't turn them back on. Only set when a box is targeted.
   */
  readonly inactiveRecipientMessage?: Maybe<string>;
  /**
   * Label of the switch that turns all of the box's notifications on or off. Only set when a box is targeted.
   */
  readonly boxSwitchLabel?: Maybe<string>;
  /**
   * Hint shown while the box switch is off. Only set when a box is targeted.
   */
  readonly boxSwitchOffHint?: Maybe<string>;
  /**
   * Label of the NotificationBox context toggle's option that edits the box's settings. Only set when a box is targeted.
   */
  readonly boxScopeLabel?: Maybe<string>;
  /**
   * Label of the NotificationBox context toggle's option that edits the global settings. Only set when a box is targeted.
   */
  readonly globalScopeLabel?: Maybe<string>;
}

/**
 * Input for {@link dbxFirebaseNotificationUserSettingsTexts}.
 */
export interface DbxFirebaseNotificationUserSettingsTextsInput {
  /**
   * The targeted NotificationBox, if any.
   */
  readonly notificationBox?: Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>;
  /**
   * Where the per-type settings live. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE}.
   */
  readonly mode?: Maybe<DbxFirebaseNotificationBoxSettingsMode>;
  /**
   * Whether the settings are inside a NotificationBox context toggle, so the override tooltip can point at it.
   */
  readonly hasToggle?: Maybe<boolean>;
}

/**
 * Returns the texts that describe the notification settings. The box texts name the box's model when {@link DbxFirebaseNotificationUserSettingsNotificationBoxConfig.modelName} is set.
 *
 * The texts follow the {@link DbxFirebaseNotificationBoxSettingsMode}, and say where the global settings take priority:
 * - `global` — the settings shown for a box are the global settings, so its hint says they apply to every box of its kind.
 * - `perBox` — the box's settings are overridden by the global settings, so its hint and override tooltip say the global settings take priority,
 *   as does the hint of the global settings page.
 *
 * @param input - The targeted NotificationBox, the mode, and whether a toggle is present.
 * @returns The texts.
 */
export function dbxFirebaseNotificationUserSettingsTexts(input: DbxFirebaseNotificationUserSettingsTextsInput): DbxFirebaseNotificationUserSettingsTexts {
  const { notificationBox, hasToggle } = input;
  const isPerBoxMode = (input.mode ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE) === 'perBox';
  let result: DbxFirebaseNotificationUserSettingsTexts;

  if (notificationBox) {
    const { modelName } = notificationBox;
    let texts: DbxFirebaseNotificationUserSettingsTexts & { readonly globalScopeLabel: string };

    if (modelName) {
      const plural = notificationBox.modelPluralName ?? `${modelName}s`;
      const sharedTexts = {
        notRecipientMessage: `You do not receive notifications for this ${modelName}.`,
        inactiveRecipientMessage: `Notifications for this ${modelName} are turned off for you.`,
        boxSwitchLabel: `Get notifications for this ${modelName}`,
        boxScopeLabel: `This ${modelName}`,
        globalScopeLabel: `All ${plural}`
      };

      texts = isPerBoxMode
        ? {
            ...sharedTexts,
            hint: `Click a setting to switch it between Default, On and Off. These settings only apply to this ${modelName}. Grayed-out settings are set by your settings for all ${plural}, which take priority.`,
            globalHint: `Click a setting to switch it between Default, On and Off. These settings apply to all ${plural} and take priority over the settings for a single ${modelName}.`,
            overrideDescription: `Your setting for all ${plural} takes priority over this.`,
            boxSwitchOffHint: `You won't get any notifications for this ${modelName}, so the settings below have no effect for now.`
          }
        : {
            ...sharedTexts,
            hint: `Click a setting to switch it between Default, On and Off. These settings apply to all ${plural}.`,
            boxSwitchOffHint: `You won't get any notifications for this ${modelName}. The settings below still apply to your other ${plural}.`
          };
    } else {
      const sharedTexts = {
        notRecipientMessage: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_NOT_RECIPIENT_MESSAGE,
        inactiveRecipientMessage: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_INACTIVE_RECIPIENT_MESSAGE,
        boxSwitchLabel: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_LABEL,
        boxScopeLabel: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SCOPE_LABEL,
        globalScopeLabel: DEFAULT_DBX_FIREBASE_NOTIFICATION_GLOBAL_SCOPE_LABEL
      };

      texts = isPerBoxMode
        ? {
            ...sharedTexts,
            hint: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_HINT,
            globalHint: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_GLOBAL_HINT,
            overrideDescription: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION,
            boxSwitchOffHint: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_OFF_HINT
          }
        : {
            ...sharedTexts,
            hint: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SETTINGS_HINT,
            boxSwitchOffHint: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SWITCH_OFF_HINT
          };
    }

    result = hasToggle && texts.overrideDescription ? { ...texts, overrideDescription: `${texts.overrideDescription} Switch to ${texts.globalScopeLabel} to change it.` } : texts;
  } else {
    result = { hint: isPerBoxMode ? DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_PER_BOX_MODE_HINT : DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_HINT };
  }

  return result;
}

/**
 * Pending cell edits, keyed by template type then delivery method. A null value clears the cell back to its default.
 */
export type DbxFirebaseNotificationSettingsCellEdits = Record<NotificationTemplateType, NotificationDeliveryMethodMap<Maybe<boolean>>>;

// MARK: List Items
/**
 * Input for {@link dbxFirebaseNotificationSettingsListItemValues}.
 */
export interface DbxFirebaseNotificationSettingsListItemValuesInput extends Pick<DbxFirebaseNotificationUserSettingsConfig, 'groups' | 'templateTypes' | 'hiddenTemplateTypes' | 'fallbackGroupBy' | 'defaultGroup'> {
  /**
   * All of the app's template type infos.
   */
  readonly typeInfos: NotificationTemplateTypeInfo[];
  /**
   * Delivery method columns, in order.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
}

/**
 * Builds the settings list rows from the app's template type infos.
 *
 * Drops hidden types and types with no configurable column, intersects each type's configurable methods with the columns,
 * applies the group fallback, keeps only the selected groups and types when any are set, and sorts the rows by `sortOrder`
 * then name.
 *
 * @param input - The template type infos, columns, selected groups and types, and grouping options.
 * @returns The list rows.
 */
export function dbxFirebaseNotificationSettingsListItemValues(input: DbxFirebaseNotificationSettingsListItemValuesInput): DbxFirebaseNotificationSettingsListItemValue[] {
  const { typeInfos, deliveryMethods: columns, hiddenTemplateTypes, fallbackGroupBy, defaultGroup } = input;
  const hidden = new Set(hiddenTemplateTypes ?? []);
  const selectedGroups = new Set(input.groups ?? []);
  const selectedTemplateTypes = new Set(input.templateTypes ?? []);
  const isSelectionSet = input.groups != null || input.templateTypes != null;

  const values: DbxFirebaseNotificationSettingsListItemValue[] = [];

  typeInfos.forEach((info) => {
    if (!info.hideFromUserSettings && !hidden.has(info.type)) {
      const configurable = new Set(notificationTemplateTypeInfoUserConfigurableDeliveryMethods(info));
      const deliveryMethods = columns.filter((method) => configurable.has(method));

      if (deliveryMethods.length) {
        let group: NotificationTemplateTypeInfoGroup;

        if (info.group) {
          group = info.group;
        } else if (fallbackGroupBy === 'notificationModel') {
          const modelType = info.notificationModelIdentity.modelType;
          group = { key: modelType, name: modelType };
        } else {
          group = defaultGroup ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP;
        }

        if (!isSelectionSet || selectedGroups.has(group.key) || selectedTemplateTypes.has(info.type)) {
          values.push({ type: info.type, name: info.name, description: info.description, group, deliveryMethods, info });
        }
      }
    }
  });

  return values.sort((a, b) => compareNotificationTemplateTypeInfoGroups({ name: a.name, sortOrder: a.info.sortOrder }, { name: b.name, sortOrder: b.info.sortOrder }));
}

// MARK: Cell States
/**
 * Input for {@link dbxFirebaseNotificationSettingsCellStates}.
 */
export interface DbxFirebaseNotificationSettingsCellStatesInput {
  /**
   * The list rows.
   */
  readonly items: DbxFirebaseNotificationSettingsListItemValue[];
  /**
   * Delivery method columns, in order.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  /**
   * The saved global config (`gc`).
   */
  readonly gc?: Maybe<Partial<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'c' | 'dm'>>>;
  /**
   * Pending cell edits.
   */
  readonly edits?: Maybe<DbxFirebaseNotificationSettingsCellEdits>;
  /**
   * Pending account-wide disabled delivery methods. Defaults to the saved `gc.dm`.
   */
  readonly disabledDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * The saved config of the targeted NotificationBox (the user's `bc` entry). When set, the cells are the box's cells: they read from this
   * config, and a cell that `gc` decides is overridden.
   */
  readonly boxConfig?: Maybe<Partial<Pick<NotificationUserNotificationBoxRecipientConfig, 'c'>>>;
  /**
   * Tooltip of a box cell that `gc` overrides. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION}.
   */
  readonly overrideDescription?: Maybe<string>;
}

/**
 * Computes the state of every template type × delivery method cell.
 *
 * A cell's default is the row's `sd` when set, otherwise {@link isNotificationDeliveryMethodEnabledByDefault} for the type.
 * A cell is disabled when its method is in the pending disabled methods.
 *
 * With a `boxConfig`, the cells read from the box's config instead of `gc`, so "Default" falls through to the global setting or the type's
 * default. A box cell is overridden wherever `gc` sets the method for the type, directly or through the type's `sd`, because `gc` takes
 * precedence at send time.
 *
 * @param input - The rows, columns, saved config and pending edits.
 * @returns The cell states keyed by template type then delivery method.
 */
export function dbxFirebaseNotificationSettingsCellStates(input: DbxFirebaseNotificationSettingsCellStatesInput): DbxFirebaseNotificationSettingsCellStates {
  const { items, deliveryMethods, gc, edits, boxConfig } = input;
  const disabledMethods = new Set(input.disabledDeliveryMethods ?? gc?.dm ?? []);
  const overrideDescription = input.overrideDescription ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION;
  const result: DbxFirebaseNotificationSettingsCellStates = {};

  items.forEach((item) => {
    const { type, info } = item;
    const savedConfig = boxConfig ? boxConfig.c?.[type] : gc?.c?.[type];
    const overridingConfig = boxConfig ? effectiveNotificationBoxRecipientTemplateConfig(gc?.c?.[type] ?? {}) : undefined;
    const typeEdits = edits?.[type];
    const available = new Set(item.deliveryMethods);
    const row: DbxFirebaseNotificationSettingsRowCellStates = {};

    deliveryMethods.forEach((method) => {
      const savedValue = readNotificationDeliveryMethodFlag(savedConfig, method) ?? null;
      const editValue = typeEdits?.[method];
      const hasEdit = editValue !== undefined;
      const value = hasEdit ? editValue : savedValue;

      const overrideValue = readNotificationDeliveryMethodFlag(overridingConfig, method);
      const override: Maybe<DbxFirebaseNotificationSettingsCellOverride> = overrideValue == null ? undefined : { value: overrideValue, description: overrideDescription };

      row[method] = {
        method,
        available: available.has(method),
        value,
        defaultValue: savedConfig?.sd ?? isNotificationDeliveryMethodEnabledByDefault(method, info),
        disabled: disabledMethods.has(method),
        modified: hasEdit && editValue !== savedValue,
        ...(override ? { override } : {})
      };
    });

    result[type] = row;
  });

  return result;
}

// MARK: Update Params
/**
 * Input for {@link dbxFirebaseNotificationUserGlobalConfigUpdateParams}.
 */
export interface DbxFirebaseNotificationUserGlobalConfigUpdateParamsInput {
  /**
   * The saved global config (`gc`).
   */
  readonly gc?: Maybe<Partial<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'c' | 'dm'>>>;
  /**
   * Pending cell edits.
   */
  readonly edits?: Maybe<DbxFirebaseNotificationSettingsCellEdits>;
  /**
   * Pending account-wide disabled delivery methods. Undefined keeps the saved list.
   */
  readonly disabledDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
}

/**
 * Input for {@link dbxFirebaseNotificationSettingsTemplateConfigUpdates}.
 */
export interface DbxFirebaseNotificationSettingsTemplateConfigUpdatesInput {
  /**
   * The saved template configs the edits apply to, such as `gc.c` or a box config's `c`.
   */
  readonly c?: Maybe<NotificationBoxRecipientTemplateConfigRecord>;
  /**
   * Pending cell edits.
   */
  readonly edits?: Maybe<DbxFirebaseNotificationSettingsCellEdits>;
}

/**
 * Maps pending cell edits to template config update entries. Only changed cells are sent, and `null` clears a cell.
 *
 * @param input - The saved template configs and pending edits.
 * @returns The update entries, one per type with a changed cell.
 */
export function dbxFirebaseNotificationSettingsTemplateConfigUpdates(input: DbxFirebaseNotificationSettingsTemplateConfigUpdatesInput): NotificationBoxRecipientTemplateConfigArrayEntryParam[] {
  const { c, edits } = input;
  const configs: NotificationBoxRecipientTemplateConfigArrayEntryParam[] = [];

  Object.entries(edits ?? {}).forEach(([type, typeEdits]) => {
    const savedConfig: NotificationBoxRecipientTemplateConfig = c?.[type] ?? {};
    const changes: Partial<Record<NotificationBoxRecipientTemplateConfigDeliveryMethodKey, Maybe<boolean>>> = {};

    (Object.entries(typeEdits) as [NotificationDeliveryMethod, Maybe<boolean>][]).forEach(([method, value]) => {
      const nextValue = value ?? null;

      if (nextValue !== (readNotificationDeliveryMethodFlag(savedConfig, method) ?? null)) {
        changes[NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY[method]] = nextValue;
      }
    });

    if (Object.keys(changes).length) {
      configs.push({ type, ...changes });
    }
  });

  return configs;
}

/**
 * Maps pending settings edits to `gc` update params.
 *
 * - only changed cells are sent, and `null` clears a cell. The server only changes the cells that are sent, and drops a
 *   type once its last cell is cleared, so types and cells that are not shown are never touched.
 * - when the disabled methods changed, the full list is sent (`null` when empty)
 *
 * @param input - The saved config and pending edits.
 * @returns The update params, or undefined when nothing changed.
 */
export function dbxFirebaseNotificationUserGlobalConfigUpdateParams(input: DbxFirebaseNotificationUserGlobalConfigUpdateParamsInput): Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams> {
  const { gc, edits, disabledDeliveryMethods } = input;
  const configs = dbxFirebaseNotificationSettingsTemplateConfigUpdates({ c: gc?.c, edits });

  let dm: Maybe<NotificationDeliveryMethod[]>;
  let dmChanged = false;

  if (disabledDeliveryMethods !== undefined) {
    const nextDm = toCanonicalNotificationDeliveryMethods(disabledDeliveryMethods);
    const savedDm = toCanonicalNotificationDeliveryMethods(gc?.dm);
    dmChanged = nextDm.join(',') !== savedDm.join(',');
    dm = nextDm.length ? nextDm : null;
  }

  let result: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;

  if (configs.length || dmChanged) {
    result = {
      ...(configs.length ? { configs } : {}),
      ...(dmChanged ? { dm } : {})
    };
  }

  return result;
}

/**
 * Input for {@link dbxFirebaseNotificationUserBoxConfigUpdateParams}.
 */
export interface DbxFirebaseNotificationUserBoxConfigUpdateParamsInput {
  /**
   * Id of the NotificationBox.
   */
  readonly notificationBoxId: NotificationBoxId;
  /**
   * The saved config of the NotificationBox (the user's `bc` entry).
   */
  readonly boxConfig?: Maybe<Partial<Pick<NotificationUserNotificationBoxRecipientConfig, 'c'>>>;
  /**
   * Pending cell edits.
   */
  readonly edits?: Maybe<DbxFirebaseNotificationSettingsCellEdits>;
}

/**
 * Maps pending cell edits to the update params of one NotificationBox config. Only changed cells are sent, and `null` clears a cell.
 *
 * @param input - The box id, its saved config and the pending edits.
 * @returns The box config update params, or undefined when nothing changed.
 */
export function dbxFirebaseNotificationUserBoxConfigUpdateParams(input: DbxFirebaseNotificationUserBoxConfigUpdateParamsInput): Maybe<UpdateNotificationUserNotificationBoxRecipientParams> {
  const { notificationBoxId, boxConfig, edits } = input;
  const configs = dbxFirebaseNotificationSettingsTemplateConfigUpdates({ c: boxConfig?.c, edits });
  return configs.length ? { nb: notificationBoxId, configs } : undefined;
}

/**
 * The `updateNotificationUser()` params for a settings save.
 */
export type DbxFirebaseNotificationUserSettingsUpdateParams = Pick<UpdateNotificationUserParams, 'gc' | 'bc' | 'resync'>;

/**
 * A pending change to whether the user gets a NotificationBox's notifications.
 */
export interface DbxFirebaseNotificationUserSettingsNotificationBoxEnabledChange {
  /**
   * Id of the NotificationBox.
   */
  readonly notificationBoxId: NotificationBoxId;
  /**
   * Whether the user gets the box's notifications.
   */
  readonly enabled: boolean;
}

/**
 * Input for {@link dbxFirebaseNotificationUserSettingsUpdateParams}.
 */
export interface DbxFirebaseNotificationUserSettingsUpdateParamsInput extends DbxFirebaseNotificationUserGlobalConfigUpdateParamsInput {
  /**
   * Id of the NotificationBox whose settings the cells edit. When set, the cell edits apply to the box's config instead of `gc`.
   */
  readonly notificationBoxId?: Maybe<NotificationBoxId>;
  /**
   * The saved config of the NotificationBox the cells edit (the user's `bc` entry).
   */
  readonly boxConfig?: Maybe<Partial<Pick<NotificationUserNotificationBoxRecipientConfig, 'c'>>>;
  /**
   * Pending change to whether the user gets a NotificationBox's notifications. Only pass a change that differs from the saved config.
   */
  readonly notificationBoxEnabledChange?: Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxEnabledChange>;
}

/**
 * Maps pending settings edits to `updateNotificationUser()` params.
 *
 * - without a box, the cell edits and disabled methods are sent as `gc` (see {@link dbxFirebaseNotificationUserGlobalConfigUpdateParams})
 * - with a box, the cell edits are sent as the box's `bc` entry, and the disabled methods are still sent as `gc`
 * - a box on/off change is sent as the box's `bc` entry `f`: {@link NotificationBoxRecipientFlag.OPT_OUT} to turn it off, or
 *   {@link NotificationBoxRecipientFlag.ENABLED} to turn it back on
 *
 * Any `bc` change is sent with `resync: true`, so it reaches the NotificationBox right away.
 *
 * @param input - The saved configs, the targeted box and the pending edits.
 * @returns The update params, or undefined when nothing changed.
 */
export function dbxFirebaseNotificationUserSettingsUpdateParams(input: DbxFirebaseNotificationUserSettingsUpdateParamsInput): Maybe<DbxFirebaseNotificationUserSettingsUpdateParams> {
  const { gc, notificationBoxId, boxConfig, edits, disabledDeliveryMethods, notificationBoxEnabledChange } = input;
  const gcParams = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc, edits: notificationBoxId ? undefined : edits, disabledDeliveryMethods });
  const boxCellParams = notificationBoxId ? dbxFirebaseNotificationUserBoxConfigUpdateParams({ notificationBoxId, boxConfig, edits }) : undefined;
  const bc: UpdateNotificationUserNotificationBoxRecipientParams[] = boxCellParams ? [boxCellParams] : [];

  if (notificationBoxEnabledChange) {
    const { notificationBoxId: nb, enabled } = notificationBoxEnabledChange;
    const f = enabled ? NotificationBoxRecipientFlag.ENABLED : NotificationBoxRecipientFlag.OPT_OUT;
    const index = bc.findIndex((x) => x.nb === nb);

    if (index === -1) {
      bc.push({ nb, f });
    } else {
      bc[index] = { ...bc[index], f };
    }
  }

  let result: Maybe<DbxFirebaseNotificationUserSettingsUpdateParams>;

  if (gcParams || bc.length) {
    result = {
      ...(gcParams ? { gc: gcParams } : {}),
      ...(bc.length ? { bc, resync: true } : {})
    };
  }

  return result;
}

/**
 * Input for {@link dbxFirebaseNotificationUserTextPhoneNumberUpdateParams}.
 */
export interface DbxFirebaseNotificationUserTextPhoneNumberUpdateParamsInput {
  /**
   * The saved global config (`gc`).
   */
  readonly gc?: Maybe<Partial<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'dm'>>>;
  /**
   * The phone number texts are sent to.
   */
  readonly phoneNumber: E164PhoneNumber;
}

/**
 * Returns the `gc` update params that save the phone number for texts and turn texts on. Saving the phone number is how the
 * user opts into texts, so texts are removed from the disabled methods.
 *
 * @param input - The saved config and the phone number.
 * @returns The update params.
 */
export function dbxFirebaseNotificationUserTextPhoneNumberUpdateParams(input: DbxFirebaseNotificationUserTextPhoneNumberUpdateParamsInput): UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams {
  const { gc, phoneNumber } = input;
  const savedDm = toCanonicalNotificationDeliveryMethods(gc?.dm);
  const dm = savedDm.filter((x) => x !== NotificationDeliveryMethod.TEXT);
  return { t: phoneNumber, ...(dm.length === savedDm.length ? {} : { dm: dm.length ? dm : null }) };
}

/**
 * Returns the configured delivery method columns, defaulting to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}, without the
 * hidden delivery methods.
 *
 * @param config - The settings config.
 * @returns The delivery method columns.
 */
export function dbxFirebaseNotificationSettingsDeliveryMethods(config: Maybe<Pick<DbxFirebaseNotificationUserSettingsConfig, 'deliveryMethods' | 'hiddenDeliveryMethods'>>): NotificationDeliveryMethod[] {
  const deliveryMethods = config?.deliveryMethods ?? DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS;
  const hidden = new Set(config?.hiddenDeliveryMethods ?? []);
  return hidden.size ? deliveryMethods.filter((method) => !hidden.has(method)) : deliveryMethods;
}
