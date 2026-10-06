import {
  DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS,
  isNotificationDeliveryMethodEnabledByDefault,
  NotificationDeliveryMethod,
  type NotificationBoxRecipientTemplateConfig,
  type NotificationBoxRecipientTemplateConfigArrayEntryParam,
  type NotificationBoxRecipientTemplateConfigDeliveryMethodKey,
  NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY,
  type NotificationDeliveryMethodMap,
  type NotificationTemplateType,
  type NotificationTemplateTypeInfo,
  type NotificationTemplateTypeInfoGroup,
  notificationTemplateTypeInfoUserConfigurableDeliveryMethods,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag,
  toCanonicalNotificationDeliveryMethods,
  type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { compareNotificationTemplateTypeInfoGroups, type DbxFirebaseNotificationSettingsCellStates, type DbxFirebaseNotificationSettingsListItemValue, type DbxFirebaseNotificationSettingsRowCellStates } from '../component/notification.settings.list';

/**
 * Default text message disclosure shown beside the text message settings.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE = 'Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.';

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
   * Delivery methods that get an account-wide on/off switch. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS}.
   */
  abstract readonly switchableDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Disclosure shown beside the text message settings. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE}.
   */
  abstract readonly textMessageDisclosure?: Maybe<string>;
  /**
   * Preferred countries for the phone number field, e.g. `['US', 'CA']`.
   */
  abstract readonly phoneNumberPreferredCountries?: Maybe<string[]>;
  /**
   * Template types to hide from the settings, in addition to types marked `hideFromUserSettings`.
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
}

/**
 * Pending cell edits, keyed by template type then delivery method. A null value clears the cell back to its default.
 */
export type DbxFirebaseNotificationSettingsCellEdits = Record<NotificationTemplateType, NotificationDeliveryMethodMap<Maybe<boolean>>>;

// MARK: List Items
/**
 * Input for {@link dbxFirebaseNotificationSettingsListItemValues}.
 */
export interface DbxFirebaseNotificationSettingsListItemValuesInput extends Pick<DbxFirebaseNotificationUserSettingsConfig, 'hiddenTemplateTypes' | 'fallbackGroupBy' | 'defaultGroup'> {
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
 * applies the group fallback, and sorts the rows by `sortOrder` then name.
 *
 * @param input - The template type infos, columns and grouping options.
 * @returns The list rows.
 */
export function dbxFirebaseNotificationSettingsListItemValues(input: DbxFirebaseNotificationSettingsListItemValuesInput): DbxFirebaseNotificationSettingsListItemValue[] {
  const { typeInfos, deliveryMethods: columns, hiddenTemplateTypes, fallbackGroupBy, defaultGroup } = input;
  const hidden = new Set(hiddenTemplateTypes ?? []);

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

        values.push({ type: info.type, name: info.name, description: info.description, group, deliveryMethods, info });
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
}

/**
 * Computes the state of every template type × delivery method cell.
 *
 * A cell's default is the row's `sd` when set, otherwise {@link isNotificationDeliveryMethodEnabledByDefault} for the type.
 * A cell is disabled when its method is in the pending disabled methods.
 *
 * @param input - The rows, columns, saved config and pending edits.
 * @returns The cell states keyed by template type then delivery method.
 */
export function dbxFirebaseNotificationSettingsCellStates(input: DbxFirebaseNotificationSettingsCellStatesInput): DbxFirebaseNotificationSettingsCellStates {
  const { items, deliveryMethods, gc, edits } = input;
  const disabledMethods = new Set(input.disabledDeliveryMethods ?? gc?.dm ?? []);
  const result: DbxFirebaseNotificationSettingsCellStates = {};

  items.forEach((item) => {
    const { type, info } = item;
    const savedConfig = gc?.c?.[type];
    const typeEdits = edits?.[type];
    const available = new Set(item.deliveryMethods);
    const row: DbxFirebaseNotificationSettingsRowCellStates = {};

    deliveryMethods.forEach((method) => {
      const savedValue = readNotificationDeliveryMethodFlag(savedConfig, method) ?? null;
      const editValue = typeEdits?.[method];
      const hasEdit = editValue !== undefined;
      const value = hasEdit ? editValue : savedValue;

      row[method] = {
        method,
        available: available.has(method),
        value,
        defaultValue: savedConfig?.sd ?? isNotificationDeliveryMethodEnabledByDefault(method, info),
        disabled: disabledMethods.has(method),
        modified: hasEdit && editValue !== savedValue
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
 * Maps pending settings edits to `gc` update params.
 *
 * - only changed cells are sent, and `null` clears a cell
 * - a type left with no set cells is sent as `{ type, remove: true }`
 * - when the disabled methods changed, the full list is sent (`null` when empty)
 *
 * @param input - The saved config and pending edits.
 * @returns The update params, or undefined when nothing changed.
 */
export function dbxFirebaseNotificationUserGlobalConfigUpdateParams(input: DbxFirebaseNotificationUserGlobalConfigUpdateParamsInput): Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams> {
  const { gc, edits, disabledDeliveryMethods } = input;
  const configs: NotificationBoxRecipientTemplateConfigArrayEntryParam[] = [];

  Object.entries(edits ?? {}).forEach(([type, typeEdits]) => {
    const savedConfig: NotificationBoxRecipientTemplateConfig = gc?.c?.[type] ?? {};
    const changes: Partial<Record<NotificationBoxRecipientTemplateConfigDeliveryMethodKey, Maybe<boolean>>> = {};

    (Object.entries(typeEdits) as [NotificationDeliveryMethod, Maybe<boolean>][]).forEach(([method, value]) => {
      const nextValue = value ?? null;

      if (nextValue !== (readNotificationDeliveryMethodFlag(savedConfig, method) ?? null)) {
        changes[NOTIFICATION_DELIVERY_METHOD_TEMPLATE_CONFIG_KEY[method]] = nextValue;
      }
    });

    if (Object.keys(changes).length) {
      const nextConfig = { ...savedConfig, ...changes };
      const isEmpty = Object.values(nextConfig).every((x) => x == null);
      configs.push(isEmpty ? { type, remove: true } : { type, ...changes });
    }
  });

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
 * Returns the configured delivery method columns, defaulting to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}.
 *
 * @param config - The settings config.
 * @returns The delivery method columns.
 */
export function dbxFirebaseNotificationSettingsDeliveryMethods(config: Maybe<Pick<DbxFirebaseNotificationUserSettingsConfig, 'deliveryMethods'>>): NotificationDeliveryMethod[] {
  return config?.deliveryMethods ?? DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS;
}
