import { Component, InjectionToken, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentConfig, DbxDialogContentFooterConfig } from '@dereekb/dbx-web';
import { KeyValueTypleValueFilter, Maybe, mergeObjects } from '@dereekb/util';

/**
 * Token used to configure the default DbxDialogContentFooterConfig for DbxScheduleSelectionCalendarDateDialogComponent.
 *
 * @deprecated use DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CONTENT_CONFIG_TOKEN instead.
 */
export const DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CLOSE_CONFIG_TOKEN = new InjectionToken('DbxScheduleSelectionCalendarDatePopupCloseConfig');

/**
 * Token used to configure the default DbxScheduleSelectionCalendarDatePopupConfig for DbxScheduleSelectionCalendarDateDialogComponent.
 */
export const DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CONTENT_CONFIG_TOKEN = new InjectionToken('DbxScheduleSelectionCalendarDatePopupContentConfig');

export interface DbxScheduleSelectionCalendarDatePopupContentConfig {
  closeConfig?: DbxDialogContentFooterConfig;
  dialogConfig?: DbxDialogContentConfig;
}

export interface DbxScheduleSelectionCalendarDatePopupConfig {
  injector: Injector;
  contentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;
  /**
   * @deprecated use contentConfig instead.
   */
  closeConfig?: Maybe<DbxDialogContentFooterConfig>;
}

@Component({
  template: `
    <dbx-dialog-content class="dbx-schedule-selection-calendar-date-dialog">
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <dbx-schedule-selection-calendar></dbx-schedule-selection-calendar>
      <dbx-dialog-content-footer [config]="closeConfig" (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `
})
export class DbxScheduleSelectionCalendarDateDialogComponent extends AbstractDialogDirective<void, DbxScheduleSelectionCalendarDatePopupConfig> {
  get contentConfig() {
    return this.data.contentConfig;
  }

  get closeConfig() {
    return this.contentConfig?.closeConfig;
  }

  static openDialog(matDialog: MatDialog, config: DbxScheduleSelectionCalendarDatePopupConfig) {
    const { injector, contentConfig: inputContentConfig, closeConfig: inputCloseConfig } = config;

    const defaultCloseConfig = injector.get<Maybe<DbxDialogContentFooterConfig>>(DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CLOSE_CONFIG_TOKEN, null);
    const defaultContentConfig = injector.get<Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>>(DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CONTENT_CONFIG_TOKEN, null);

    const contentConfig = mergeObjects([defaultContentConfig, inputContentConfig], KeyValueTypleValueFilter.NULL);
    const closeConfig = mergeObjects([defaultCloseConfig, contentConfig?.closeConfig, inputCloseConfig], KeyValueTypleValueFilter.NULL);
    contentConfig.closeConfig = closeConfig;

    return matDialog.open(DbxScheduleSelectionCalendarDateDialogComponent, {
      height: 'calc(var(--vh100) * 0.9)',
      width: '80vw',
      minHeight: 400,
      minWidth: 360,
      ...contentConfig.dialogConfig,
      injector,
      data: {
        config,
        contentConfig
      }
    });
  }
}
