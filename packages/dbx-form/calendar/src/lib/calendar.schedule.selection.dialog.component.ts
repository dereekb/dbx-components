import { ChangeDetectionStrategy, Component, InjectionToken, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentConfig, DbxDialogContentDirective, DbxDialogContentFooterConfig, DbxDialogInteractionModule, sanitizeDbxDialogContentConfig } from '@dereekb/dbx-web';
import { KeyValueTypleValueFilter, Maybe, mergeObjects } from '@dereekb/util';
import { DbxScheduleSelectionCalendarComponent } from './calendar.schedule.selection.component';

/**
 * Token used to configure the default DbxScheduleSelectionCalendarDatePopupConfig for DbxScheduleSelectionCalendarDateDialogComponent.
 */
export const DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CONTENT_CONFIG_TOKEN = new InjectionToken('DbxScheduleSelectionCalendarDatePopupContentConfig');

export interface DbxScheduleSelectionCalendarDatePopupContentConfig {
  readonly closeConfig?: DbxDialogContentFooterConfig;
  readonly dialogConfig?: DbxDialogContentConfig;
}

export interface DbxScheduleSelectionCalendarDatePopupConfig {
  readonly injector: Injector;
  readonly contentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;
}

@Component({
  template: `
    <dbx-dialog-content class="dbx-schedule-selection-calendar-date-dialog">
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <dbx-schedule-selection-calendar></dbx-schedule-selection-calendar>
      <dbx-dialog-content-footer [config]="closeConfig" (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogInteractionModule, DbxScheduleSelectionCalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxScheduleSelectionCalendarDateDialogComponent extends AbstractDialogDirective<void, DbxScheduleSelectionCalendarDatePopupConfig> {
  get contentConfig() {
    return this.data.contentConfig;
  }

  get closeConfig() {
    return this.contentConfig?.closeConfig;
  }

  static openDialog(matDialog: MatDialog, config: DbxScheduleSelectionCalendarDatePopupConfig) {
    const { injector, contentConfig: inputContentConfig } = config;
    const defaultContentConfig = injector.get<Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>>(DEFAULT_DBX_SCHEDULE_SELECTION_CALENDAR_DATE_POPUP_CONTENT_CONFIG_TOKEN, null);
    const contentConfig = mergeObjects([defaultContentConfig, inputContentConfig], KeyValueTypleValueFilter.NULL);
    return matDialog.open(DbxScheduleSelectionCalendarDateDialogComponent, {
      height: 'calc(var(--vh100) * 0.9)',
      width: '80vw',
      minHeight: 400,
      minWidth: 360,
      ...sanitizeDbxDialogContentConfig(contentConfig.dialogConfig),
      injector,
      data: {
        config,
        contentConfig
      }
    });
  }
}
