import { Component, InjectionToken, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentFooterConfig } from '@dereekb/dbx-web';
import { KeyValueTypleValueFilter, Maybe, mergeObjects } from '@dereekb/util';

/**
 * Token used to configure the default DbxDialogContentFooterConfig for DbxScheduleSelectionCalendarDateDialogComponent.
 */
export const DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CLOSE_CONFIG_TOKEN = new InjectionToken('DbxScheduleSelectionCalendarDatePopupCloseConfig');

export interface DbxScheduleSelectionCalendarDatePopupConfig {
  injector: Injector;
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
  get closeConfig() {
    return this.data.closeConfig;
  }

  static openDialog(matDialog: MatDialog, config: DbxScheduleSelectionCalendarDatePopupConfig) {
    const { injector, closeConfig: inputCloseConfig } = config;
    const defaultCloseConfig = injector.get<Maybe<DbxDialogContentFooterConfig>>(DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CLOSE_CONFIG_TOKEN, null);
    const closeConfig = mergeObjects([defaultCloseConfig, inputCloseConfig], KeyValueTypleValueFilter.NULL);

    return matDialog.open(DbxScheduleSelectionCalendarDateDialogComponent, {
      injector,
      height: 'calc(var(--vh100) * 0.9)',
      minHeight: 400,
      width: '80vw',
      minWidth: 360,
      data: {
        config,
        closeConfig
      }
    });
  }
}
