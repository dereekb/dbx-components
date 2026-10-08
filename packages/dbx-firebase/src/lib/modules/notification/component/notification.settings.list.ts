import { type Signal, type Type } from '@angular/core';
import { type DbxListTitleGroupData, type DbxListTitleGroupTitleDelegate, type DbxValueAsListItem } from '@dereekb/dbx-web';
import {
  compareNotificationTemplateTypeInfoGroups,
  type NotificationDeliveryMethod,
  type NotificationSettingsCellOverride,
  type NotificationSettingsCellState,
  type NotificationSettingsCellStates,
  type NotificationSettingsListItemValue,
  type NotificationSettingsRowCellStates,
  type NotificationTemplateType,
  type NotificationTemplateTypeInfoGroup,
  type NotificationTemplateTypeInfoGroupKey
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * A notification template type row in the notification settings list.
 */
export type DbxFirebaseNotificationSettingsListItemValue = NotificationSettingsListItemValue;

/**
 * List item for a {@link DbxFirebaseNotificationSettingsListItemValue}.
 */
export type DbxFirebaseNotificationSettingsListItem = DbxValueAsListItem<DbxFirebaseNotificationSettingsListItemValue>;

/**
 * State of one template type × delivery method cell.
 */
export type DbxFirebaseNotificationSettingsCellState = NotificationSettingsCellState;

/**
 * A higher-priority setting that decides a cell, so the cell's own value has no effect.
 */
export type DbxFirebaseNotificationSettingsCellOverride = NotificationSettingsCellOverride;

/**
 * Cell states for a template type row, keyed by delivery method.
 */
export type DbxFirebaseNotificationSettingsRowCellStates = NotificationSettingsRowCellStates;

/**
 * Cell states for every row, keyed by template type.
 */
export type DbxFirebaseNotificationSettingsCellStates = NotificationSettingsCellStates;

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

// Moved to @dereekb/firebase. Re-exported here for existing imports.
export { compareNotificationTemplateTypeInfoGroups };
