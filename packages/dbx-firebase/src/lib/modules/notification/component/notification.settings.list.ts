import { type Signal, type Type } from '@angular/core';
import { type DbxListTitleGroupData, type DbxListTitleGroupTitleDelegate, type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type NotificationDeliveryMethod, type NotificationTemplateType, type NotificationTemplateTypeInfo, type NotificationTemplateTypeInfoGroup, type NotificationTemplateTypeInfoGroupKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * A notification template type row in the notification settings list.
 */
export interface DbxFirebaseNotificationSettingsListItemValue {
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
   * Delivery methods the user can configure for the type, in column order. Columns not in this list show as unavailable.
   */
  readonly deliveryMethods: NotificationDeliveryMethod[];
  /**
   * Template type info the row was built from.
   */
  readonly info: NotificationTemplateTypeInfo;
}

/**
 * List item for a {@link DbxFirebaseNotificationSettingsListItemValue}.
 */
export type DbxFirebaseNotificationSettingsListItem = DbxValueAsListItem<DbxFirebaseNotificationSettingsListItemValue>;

/**
 * State of one template type × delivery method cell.
 */
export interface DbxFirebaseNotificationSettingsCellState {
  /**
   * Delivery method of the cell's column.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * Whether the user can configure the method for the template type.
   */
  readonly available: boolean;
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
  readonly override?: Maybe<DbxFirebaseNotificationSettingsCellOverride>;
}

/**
 * A higher-priority setting that decides a cell, so the cell's own value has no effect.
 */
export interface DbxFirebaseNotificationSettingsCellOverride {
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
export type DbxFirebaseNotificationSettingsRowCellStates = Partial<Record<NotificationDeliveryMethod, DbxFirebaseNotificationSettingsCellState>>;

/**
 * Cell states for every row, keyed by template type.
 */
export type DbxFirebaseNotificationSettingsCellStates = Record<NotificationTemplateType, DbxFirebaseNotificationSettingsRowCellStates>;

/**
 * Delegate that feeds live state to the notification settings list and receives cell changes.
 *
 * The list rows read their cells from these signals instead of from their item values, so changing a cell does not recreate the row.
 */
export abstract class DbxFirebaseNotificationSettingsListDelegate {
  /**
   * Delivery method columns, in order.
   */
  abstract readonly columnsSignal: Signal<NotificationDeliveryMethod[]>;
  /**
   * Cell states for every row.
   */
  abstract readonly cellStatesSignal: Signal<DbxFirebaseNotificationSettingsCellStates>;
  /**
   * Whether every cell is disabled, e.g. while saving.
   */
  abstract readonly disabledSignal: Signal<boolean>;
  /**
   * Sets a cell's pending value. Null clears the cell back to its default.
   */
  abstract setCellValue(type: NotificationTemplateType, method: NotificationDeliveryMethod, value: Maybe<boolean>): void;
}

/**
 * Group data for a notification settings list group header.
 */
export interface DbxFirebaseNotificationSettingsListGroupData extends DbxListTitleGroupData<NotificationTemplateTypeInfoGroupKey> {
  /**
   * The template type group.
   */
  readonly group: NotificationTemplateTypeInfoGroup;
}

/**
 * Creates the {@link DbxListTitleGroupTitleDelegate} that groups notification settings rows by their template type group,
 * sorted by the group's `sortOrder` then name.
 *
 * @param headerComponentClass - Header component to render for each group.
 * @returns The title group delegate.
 */
export function dbxFirebaseNotificationSettingsListGroupDelegate(headerComponentClass?: Maybe<Type<unknown>>): DbxListTitleGroupTitleDelegate<DbxFirebaseNotificationSettingsListItemValue, NotificationTemplateTypeInfoGroupKey, DbxFirebaseNotificationSettingsListGroupData> {
  return {
    groupValueForItem: (item) => item.itemValue.group.key,
    dataForGroupValue: (value, items) => {
      const group = items[0].itemValue.group;
      return { value, group, title: group.name, hint: group.description ?? undefined };
    },
    sortGroupsByData: (a, b) => compareNotificationTemplateTypeInfoGroups(a.group, b.group),
    headerComponentClass: headerComponentClass ?? undefined
  };
}

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
