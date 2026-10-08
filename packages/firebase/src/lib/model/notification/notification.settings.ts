/**
 * @module notification.settings
 *
 * Pure logic behind a user's notification settings: the template type rows a settings view shows, and the state of each
 * template type × delivery method cell. Shared by the settings UI in `@dereekb/dbx-firebase` and the CLI in `@dereekb/dbx-cli`, so
 * both show the same rows and resolve "Default" the same way.
 */
import { type Maybe } from '@dereekb/util';
import {
  effectiveNotificationBoxRecipientTemplateConfig,
  isNotificationDeliveryMethodEnabledByDefault,
  type NotificationDeliveryMethod,
  type NotificationDeliveryMethodMap,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  type NotificationUserNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag
} from './notification.config';
import { notificationTemplateTypeInfoForcedDeliveryMethods, notificationTemplateTypeInfoUserConfigurableDeliveryMethods, type NotificationTemplateTypeInfo, type NotificationTemplateTypeInfoGroup, type NotificationTemplateTypeInfoGroupKey } from './notification.details';
import { type NotificationTemplateType } from './notification.id';

/**
 * Group for template types that have no group, when not grouping by notification model.
 */
export const DEFAULT_NOTIFICATION_SETTINGS_GROUP: NotificationTemplateTypeInfoGroup = { key: '_', name: 'Notifications' };

/**
 * Default description of a NotificationBox cell that the global settings (`gc`) override, when the box's model has no name.
 */
export const DEFAULT_NOTIFICATION_SETTINGS_BOX_OVERRIDE_DESCRIPTION = 'Your general setting for this notification takes priority over this.';

/**
 * How to group template types that have no group.
 *
 * - `none` — use the default group
 * - `notificationModel` — group by the model the notification is attached to
 */
export type NotificationSettingsFallbackGroupBy = 'none' | 'notificationModel';

/**
 * A notification template type row in a notification settings view.
 */
export interface NotificationSettingsListItemValue {
  /**
   * Template type the row configures.
   */
  readonly type: NotificationTemplateType;
  /**
   * Display name of the template type.
   */
  readonly name: string;
  /**
   * Description of the template type.
   */
  readonly description?: Maybe<string>;
  /**
   * Group the row is listed under.
   */
  readonly group: NotificationTemplateTypeInfoGroup;
  /**
   * Delivery methods the user can configure for the type, in column order. Columns not in this list or in {@link forcedDeliveryMethods}
   * show as unavailable.
   *
   * Forced delivery methods are left out, since they cannot be configured.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  /**
   * Delivery methods that are always on for the type (`NotificationTemplateTypeInfo.forcedDeliveryMethods`), in column order. Shown as
   * always-on cells that cannot be changed.
   *
   * Always set by {@link notificationSettingsListItemValues}. Optional so custom list builders still compile.
   */
  readonly forcedDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Template type info the row was built from.
   */
  readonly info: NotificationTemplateTypeInfo;
}

/**
 * State of one template type × delivery method cell.
 */
export interface NotificationSettingsCellState {
  /**
   * Delivery method of the cell's column.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * Whether the user can configure the method for the template type. False for a forced cell.
   */
  readonly available: boolean;
  /**
   * Set when the method is always on for the template type (`NotificationTemplateTypeInfo.forcedDeliveryMethods`). A forced cell has no value,
   * defaults to on, ignores pending edits and is never overridden. It is only off when the method is turned off account-wide (`disabled`).
   */
  readonly forced?: Maybe<boolean>;
  /**
   * Explicit value of the cell, including pending edits. Null/undefined means the cell uses its default.
   */
  readonly value: Maybe<boolean>;
  /**
   * What the cell resolves to when it has no explicit value.
   */
  readonly defaultValue: boolean;
  /**
   * Whether the method is turned off account-wide, which disables the cell.
   */
  readonly disabled: boolean;
  /**
   * Whether the cell has a pending edit that differs from the saved value.
   */
  readonly modified: boolean;
  /**
   * Set when a higher-priority setting decides the cell, such as the global setting (`gc`) for a NotificationBox's cell. The cell then shows
   * the override's value and cannot be changed.
   */
  readonly override?: Maybe<NotificationSettingsCellOverride>;
}

/**
 * A higher-priority setting that decides a cell, so the cell's own value has no effect.
 */
export interface NotificationSettingsCellOverride {
  /**
   * Whether the overriding setting sends the method.
   */
  readonly value: boolean;
  /**
   * Explains what overrides the cell, shown as its tooltip. E.g. "Your setting for all guestbooks overrides this."
   */
  readonly description: string;
}

/**
 * Cell states for a template type row, keyed by delivery method.
 */
export type NotificationSettingsRowCellStates = Partial<Record<NotificationDeliveryMethod, NotificationSettingsCellState>>;

/**
 * Cell states for every row, keyed by template type.
 */
export type NotificationSettingsCellStates = Record<NotificationTemplateType, NotificationSettingsRowCellStates>;

/**
 * Pending cell edits, keyed by template type then delivery method. A null value clears the cell back to its default.
 */
export type NotificationSettingsCellEdits = Record<NotificationTemplateType, NotificationDeliveryMethodMap<Maybe<boolean>>>;

/**
 * Compares two template type groups by `sortOrder` (unset sorts last) then name.
 *
 * @param a - The first group.
 * @param b - The second group.
 * @returns A sort comparison result.
 */
export function compareNotificationTemplateTypeInfoGroups(a: Pick<NotificationTemplateTypeInfoGroup, 'name' | 'sortOrder'>, b: Pick<NotificationTemplateTypeInfoGroup, 'name' | 'sortOrder'>): number {
  const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
  return orderDiff === 0 ? a.name.localeCompare(b.name) : orderDiff;
}

// MARK: List Items
/**
 * Input for {@link notificationSettingsListItemValues}.
 */
export interface NotificationSettingsListItemValuesInput {
  /**
   * All of the app's template type infos.
   */
  readonly typeInfos: NotificationTemplateTypeInfo[];
  /**
   * Delivery method columns, in order.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  /**
   * Groups to show. When {@link groups} or {@link templateTypes} is set, only the template types in these groups or in
   * {@link templateTypes} are shown.
   *
   * Matches the group a type is listed under, including the fallback group of a type with no group.
   */
  readonly groups?: Maybe<NotificationTemplateTypeInfoGroupKey[]>;
  /**
   * Template types to show. When {@link groups} or {@link templateTypes} is set, only these template types and the types in
   * {@link groups} are shown.
   */
  readonly templateTypes?: Maybe<NotificationTemplateType[]>;
  /**
   * Template types to hide, in addition to types marked `hideFromUserSettings`. Applies after {@link groups} and {@link templateTypes}.
   */
  readonly hiddenTemplateTypes?: Maybe<NotificationTemplateType[]>;
  /**
   * How to group template types that have no group. Defaults to `none`.
   */
  readonly fallbackGroupBy?: Maybe<NotificationSettingsFallbackGroupBy>;
  /**
   * Group for template types that have no group. Defaults to {@link DEFAULT_NOTIFICATION_SETTINGS_GROUP}.
   */
  readonly defaultGroup?: Maybe<NotificationTemplateTypeInfoGroup>;
}

/**
 * Returns the group a template type is listed under: its own group, otherwise the fallback group.
 *
 * @param info - The template type info.
 * @param input - The grouping options.
 * @returns The group.
 */
export function notificationSettingsGroupForTemplateTypeInfo(info: Pick<NotificationTemplateTypeInfo, 'group' | 'notificationModelIdentity'>, input: Pick<NotificationSettingsListItemValuesInput, 'fallbackGroupBy' | 'defaultGroup'>): NotificationTemplateTypeInfoGroup {
  let group: NotificationTemplateTypeInfoGroup;

  if (info.group) {
    group = info.group;
  } else if (input.fallbackGroupBy === 'notificationModel') {
    const modelType = info.notificationModelIdentity.modelType;
    group = { key: modelType, name: modelType };
  } else {
    group = input.defaultGroup ?? DEFAULT_NOTIFICATION_SETTINGS_GROUP;
  }

  return group;
}

/**
 * Builds the settings list rows from the app's template type infos.
 *
 * Drops hidden types and types with no configurable or forced column, intersects each type's configurable and forced methods with the columns
 * (a forced method is never configurable),
 * applies the group fallback, keeps only the selected groups and types when any are set, and sorts the rows by `sortOrder`
 * then name.
 *
 * @param input - The template type infos, columns, selected groups and types, and grouping options.
 * @returns The list rows.
 */
export function notificationSettingsListItemValues(input: NotificationSettingsListItemValuesInput): NotificationSettingsListItemValue[] {
  const { typeInfos, deliveryMethods: columns, hiddenTemplateTypes } = input;
  const hidden = new Set(hiddenTemplateTypes ?? []);
  const selectedGroups = new Set(input.groups ?? []);
  const selectedTemplateTypes = new Set(input.templateTypes ?? []);
  const isSelectionSet = input.groups != null || input.templateTypes != null;

  const values: NotificationSettingsListItemValue[] = [];

  typeInfos.forEach((info) => {
    if (!info.hideFromUserSettings && !hidden.has(info.type)) {
      const forced = new Set(notificationTemplateTypeInfoForcedDeliveryMethods(info));
      const configurable = new Set(notificationTemplateTypeInfoUserConfigurableDeliveryMethods(info));
      const deliveryMethods = columns.filter((method) => configurable.has(method) && !forced.has(method));
      const forcedDeliveryMethods = columns.filter((method) => forced.has(method));

      if (deliveryMethods.length || forcedDeliveryMethods.length) {
        const group = notificationSettingsGroupForTemplateTypeInfo(info, input);

        if (!isSelectionSet || selectedGroups.has(group.key) || selectedTemplateTypes.has(info.type)) {
          values.push({ type: info.type, name: info.name, description: info.description, group, deliveryMethods, forcedDeliveryMethods, info });
        }
      }
    }
  });

  return values.sort((a, b) => compareNotificationTemplateTypeInfoGroups({ name: a.name, sortOrder: a.info.sortOrder }, { name: b.name, sortOrder: b.info.sortOrder }));
}

// MARK: Cell States
/**
 * Input for {@link notificationSettingsCellStates}.
 */
export interface NotificationSettingsCellStatesInput {
  /**
   * The list rows.
   */
  readonly items: NotificationSettingsListItemValue[];
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
  readonly edits?: Maybe<NotificationSettingsCellEdits>;
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
   * Description of a box cell that `gc` overrides. Defaults to {@link DEFAULT_NOTIFICATION_SETTINGS_BOX_OVERRIDE_DESCRIPTION}.
   */
  readonly overrideDescription?: Maybe<string>;
}

/**
 * Computes the state of every template type × delivery method cell.
 *
 * A cell's default is the row's `sd` when set, otherwise {@link isNotificationDeliveryMethodEnabledByDefault} for the type.
 * A cell is disabled when its method is in the pending disabled methods.
 *
 * A forced cell (see {@link NotificationSettingsCellState.forced}) is unavailable, has no value, defaults to on and ignores pending edits. It is
 * never overridden, since the user's own settings for the type are skipped for a forced method at send time.
 *
 * With a `boxConfig`, the cells read from the box's config instead of `gc`, so "Default" falls through to the global setting or the type's
 * default. A box cell is overridden wherever `gc` sets the method for the type, directly or through the type's `sd`, because `gc` takes
 * precedence at send time.
 *
 * @param input - The rows, columns, saved config and pending edits.
 * @returns The cell states keyed by template type then delivery method.
 */
export function notificationSettingsCellStates(input: NotificationSettingsCellStatesInput): NotificationSettingsCellStates {
  const { items, deliveryMethods, gc, edits, boxConfig } = input;
  const disabledMethods = new Set(input.disabledDeliveryMethods ?? gc?.dm ?? []);
  const overrideDescription = input.overrideDescription ?? DEFAULT_NOTIFICATION_SETTINGS_BOX_OVERRIDE_DESCRIPTION;
  const result: NotificationSettingsCellStates = {};

  items.forEach((item) => {
    const { type, info } = item;
    const savedConfig = boxConfig ? boxConfig.c?.[type] : gc?.c?.[type];
    const overridingConfig = boxConfig ? effectiveNotificationBoxRecipientTemplateConfig(gc?.c?.[type] ?? {}) : undefined;
    const typeEdits = edits?.[type];
    const available = new Set(item.deliveryMethods);
    const forced = new Set(item.forcedDeliveryMethods ?? []);
    const row: NotificationSettingsRowCellStates = {};

    deliveryMethods.forEach((method) => {
      const disabled = disabledMethods.has(method);

      if (forced.has(method)) {
        row[method] = { method, available: false, forced: true, value: null, defaultValue: true, disabled, modified: false };
      } else {
        const savedValue = readNotificationDeliveryMethodFlag(savedConfig, method) ?? null;
        const editValue = typeEdits?.[method];
        const hasEdit = editValue !== undefined;
        const value = hasEdit ? editValue : savedValue;

        const overrideValue = readNotificationDeliveryMethodFlag(overridingConfig, method);
        const override: Maybe<NotificationSettingsCellOverride> = overrideValue == null ? undefined : { value: overrideValue, description: overrideDescription };

        row[method] = {
          method,
          available: available.has(method),
          value,
          defaultValue: savedConfig?.sd ?? isNotificationDeliveryMethodEnabledByDefault(method, info),
          disabled,
          modified: hasEdit && editValue !== savedValue,
          ...(override ? { override } : {})
        };
      }
    });

    result[type] = row;
  });

  return result;
}
