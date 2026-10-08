import { Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { of } from 'rxjs';
import {
  AbstractDbxListViewDirective,
  AbstractDbxListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  DbxButtonComponent,
  DbxListWrapperComponentImportsModule,
  DbxRotatingButtonDirective,
  DbxTextColorDirective,
  DbxValueListViewComponentImportsModule,
  DEFAULT_DBX_TRISTATE_ON_ICON,
  DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  type DbxRotatingButtonConfig,
  type DbxTristateValue,
  type DbxValueListViewConfig,
  dbxTristateRotatingButtonConfig,
  provideDbxListView
} from '@dereekb/dbx-web';
import { type NotificationDeliveryMethod } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { NOTIFICATION_DELIVERY_METHOD_ICONS, NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS } from '../service/healthcheck.presentation';
import { type DbxFirebaseNotificationSettingsCellState, DbxFirebaseNotificationSettingsListDelegate, type DbxFirebaseNotificationSettingsListItem, type DbxFirebaseNotificationSettingsListItemValue } from './notification.settings.list';

/**
 * Grouped list of notification template types with one rotating default/on/off button per delivery method column.
 *
 * Requires a {@link DbxFirebaseNotificationSettingsListDelegate} from an ancestor, which supplies the columns and cell states and
 * receives cell changes. Group the rows with `[dbxListTitleGroup]` and {@link dbxFirebaseNotificationSettingsListGroupDelegate}.
 *
 * @example
 * ```html
 * <dbx-firebase-notification-settings-list [state]="listState$" [dbxListTitleGroup]="groupDelegate"></dbx-firebase-notification-settings-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-settings-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-firebase-notification-settings-list dbx-list-auto-height dbx-list-no-hover-effects'
  }
})
export class DbxFirebaseNotificationSettingsListComponent extends AbstractDbxListWrapperDirective<DbxFirebaseNotificationSettingsListItemValue> {
  constructor() {
    super({
      componentClass: DbxFirebaseNotificationSettingsListViewComponent
    });
  }
}

@Component({
  selector: 'dbx-firebase-notification-settings-list-view',
  template: DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxValueListViewComponentImportsModule],
  providers: provideDbxListView(DbxFirebaseNotificationSettingsListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  }
})
export class DbxFirebaseNotificationSettingsListViewComponent extends AbstractDbxListViewDirective<DbxFirebaseNotificationSettingsListItemValue> {
  // keyed by the template type with no anchor: rows are not clickable, and the cells read live state from the delegate,
  // so a cell change never recreates the row
  readonly config: DbxValueListViewConfig<DbxFirebaseNotificationSettingsListItem> = {
    componentClass: DbxFirebaseNotificationSettingsListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, key: value.type, icon: undefined })))
  };
}

/**
 * A cell rendered by {@link DbxFirebaseNotificationSettingsListViewItemComponent}.
 */
export interface DbxFirebaseNotificationSettingsListViewItemCell {
  readonly method: NotificationDeliveryMethod;
  readonly state: Maybe<DbxFirebaseNotificationSettingsCellState>;
  readonly rotatingConfig: Maybe<DbxRotatingButtonConfig<DbxTristateValue>>;
  /**
   * The value shown: the override's value when the cell is overridden, otherwise the cell's own value.
   */
  readonly value: Maybe<boolean>;
  /**
   * Whether a higher-priority setting decides the cell, so it cannot be changed.
   */
  readonly overridden: boolean;
  /**
   * Whether the method is always on for the template type. A forced cell is shown as an always-on icon that cannot be selected.
   */
  readonly forced: boolean;
  /**
   * Explains why the cell is disabled or always on: its method is turned off account-wide, a higher-priority setting overrides it, or the
   * method is forced on for the type.
   */
  readonly tooltip: Maybe<string>;
  /**
   * Accessible label of a forced cell's icon.
   */
  readonly ariaLabel: string;
}

/**
 * The icon shown in a forced (always-on) notification settings cell.
 */
export const DBX_FIREBASE_NOTIFICATION_SETTINGS_FORCED_CELL_ICON = DEFAULT_DBX_TRISTATE_ON_ICON;

@Component({
  selector: 'dbx-firebase-notification-settings-list-view-item',
  template: `
    <div class="dbx-firebase-notification-settings-row">
      <div class="dbx-firebase-notification-settings-row-label">
        <span class="dbx-firebase-notification-settings-row-name">{{ itemValue.name }}</span>
        @if (itemValue.description) {
          <span class="dbx-firebase-notification-settings-row-description dbx-hint">{{ itemValue.description }}</span>
        }
      </div>
      @for (cell of cellsSignal(); track cell.method) {
        <div class="dbx-firebase-notification-settings-cell" [class.dbx-firebase-notification-settings-cell-modified]="cell.state?.modified" [class.dbx-firebase-notification-settings-cell-overridden]="cell.overridden">
          @if (cell.forced) {
            <!-- a forced cell is a plain icon rather than a disabled button, since a disabled icon button is greyed out -->
            <span class="dbx-firebase-notification-settings-cell-forced" [matTooltip]="cell.tooltip ?? ''" [matTooltipDisabled]="!cell.tooltip">
              <mat-icon role="img" [attr.aria-label]="cell.ariaLabel" [dbxTextColor]="cell.state?.disabled ? 'disabled' : 'success'">{{ forcedCellIcon }}</mat-icon>
            </span>
          } @else if (cell.rotatingConfig) {
            <!-- the tooltip is on the wrapper, since a disabled button does not receive hover events -->
            <span class="dbx-firebase-notification-settings-cell-button" [matTooltip]="cell.tooltip ?? ''" [matTooltipDisabled]="!cell.tooltip">
              <dbx-button iconOnly [disabled]="delegate.disabledSignal() || cell.state?.disabled || cell.overridden" [dbxRotatingButton]="cell.rotatingConfig" [dbxRotatingButtonValue]="cell.value" (dbxRotatingButtonValueChange)="setCellValue(cell.method, $event)"></dbx-button>
            </span>
          } @else {
            <span class="dbx-firebase-notification-settings-cell-unavailable dbx-hint" aria-hidden="true">—</span>
          }
        </div>
      }
    </div>
  `,
  imports: [DbxButtonComponent, DbxRotatingButtonDirective, DbxTextColorDirective, MatIcon, MatTooltip]
})
export class DbxFirebaseNotificationSettingsListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseNotificationSettingsListItemValue> {
  readonly delegate = inject(DbxFirebaseNotificationSettingsListDelegate);
  readonly forcedCellIcon = DBX_FIREBASE_NOTIFICATION_SETTINGS_FORCED_CELL_ICON;

  readonly cellsSignal = computed<DbxFirebaseNotificationSettingsListViewItemCell[]>(() => {
    const { type, name } = this.itemValue;
    const rowStates = this.delegate.cellStatesSignal()[type];

    return this.delegate.columnsSignal().map((method) => {
      const state = rowStates?.[method];
      const methodLabel = NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method];
      const label = `${name} ${methodLabel}`;
      const forced = Boolean(state?.forced);
      const rotatingConfig = state?.available && !forced ? dbxTristateRotatingButtonConfig({ label, defaultValue: state.defaultValue }) : undefined;
      const override = forced ? undefined : state?.override;
      const value = override ? override.value : state?.value;
      let tooltip: Maybe<string>;

      // a method turned off account-wide is off regardless of the override or forced setting
      if (state?.disabled) {
        tooltip = `${methodLabel} notifications are turned off.`;
      } else if (forced) {
        tooltip = `${methodLabel} is always on for this notification.`;
      } else {
        tooltip = override?.description;
      }

      return { method, state, rotatingConfig, value, overridden: Boolean(override), forced, ariaLabel: `${label}: Always on`, tooltip };
    });
  });

  setCellValue(method: NotificationDeliveryMethod, value: Maybe<boolean>) {
    this.delegate.setCellValue(this.itemValue.type, method, value);
  }
}

/**
 * Icon and short label for a delivery method column header.
 */
export interface DbxFirebaseNotificationSettingsListColumn {
  readonly method: NotificationDeliveryMethod;
  readonly icon: string;
  readonly label: string;
}

/**
 * Returns the column header icon and short label for each delivery method.
 *
 * @param methods - The delivery method columns.
 * @returns The column headers.
 */
export function dbxFirebaseNotificationSettingsListColumns(methods: NotificationDeliveryMethod[]): DbxFirebaseNotificationSettingsListColumn[] {
  return methods.map((method) => ({ method, icon: NOTIFICATION_DELIVERY_METHOD_ICONS[method], label: NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method] }));
}
