import { Component, computed, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { of } from 'rxjs';
import {
  AbstractDbxListViewDirective,
  AbstractDbxListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  DbxButtonComponent,
  DbxListWrapperComponentImportsModule,
  DbxRotatingButtonDirective,
  DbxValueListViewComponentImportsModule,
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
  readonly disabledTooltip: Maybe<string>;
}

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
        <div class="dbx-firebase-notification-settings-cell" [class.dbx-firebase-notification-settings-cell-modified]="cell.state?.modified">
          @if (cell.rotatingConfig) {
            <span class="dbx-firebase-notification-settings-cell-button" [matTooltip]="cell.disabledTooltip ?? ''" [matTooltipDisabled]="!cell.disabledTooltip">
              <dbx-button iconOnly [disabled]="delegate.disabledSignal() || cell.state?.disabled" [dbxRotatingButton]="cell.rotatingConfig" [dbxRotatingButtonValue]="cell.state?.value" (dbxRotatingButtonValueChange)="setCellValue(cell.method, $event)"></dbx-button>
            </span>
          } @else {
            <span class="dbx-firebase-notification-settings-cell-unavailable dbx-hint" aria-hidden="true">—</span>
          }
        </div>
      }
    </div>
  `,
  imports: [DbxButtonComponent, DbxRotatingButtonDirective, MatTooltip]
})
export class DbxFirebaseNotificationSettingsListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseNotificationSettingsListItemValue> {
  readonly delegate = inject(DbxFirebaseNotificationSettingsListDelegate);

  readonly cellsSignal = computed<DbxFirebaseNotificationSettingsListViewItemCell[]>(() => {
    const { type, name } = this.itemValue;
    const rowStates = this.delegate.cellStatesSignal()[type];

    return this.delegate.columnsSignal().map((method) => {
      const state = rowStates?.[method];
      const label = `${name} ${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method]}`;
      const rotatingConfig = state?.available ? dbxTristateRotatingButtonConfig({ label, defaultValue: state.defaultValue }) : undefined;
      const disabledTooltip = state?.disabled ? `${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method]} notifications are turned off.` : undefined;
      return { method, state, rotatingConfig, disabledTooltip };
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
