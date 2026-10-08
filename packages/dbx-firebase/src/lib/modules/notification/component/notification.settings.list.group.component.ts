import { Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { AbstractDbxListTitleGroupHeaderComponent } from '@dereekb/dbx-web';
import { type NotificationTemplateTypeInfoGroupKey } from '@dereekb/firebase';
import { DbxFirebaseNotificationSettingsListDelegate, type DbxFirebaseNotificationSettingsListGroupData } from './notification.settings.list';
import { dbxFirebaseNotificationSettingsListColumns } from './notification.settings.list.component';

/**
 * Group header for the notification settings list. Shows the group name and description, and a label for each delivery method
 * column that lines up with the row cells.
 */
@Component({
  selector: 'dbx-firebase-notification-settings-list-group-header',
  template: `
    <div class="dbx-firebase-notification-settings-row dbx-firebase-notification-settings-group-header">
      <div class="dbx-firebase-notification-settings-row-label">
        <span class="mat-subtitle-2">{{ data.title }}</span>
        @if (data.hint) {
          <span class="dbx-hint">{{ data.hint }}</span>
        }
      </div>
      @for (column of columnsSignal(); track column.method) {
        <div class="dbx-firebase-notification-settings-cell dbx-firebase-notification-settings-column-header">
          <mat-icon aria-hidden="true">{{ column.icon }}</mat-icon>
          <span class="dbx-firebase-notification-settings-column-label">{{ column.label }}</span>
        </div>
      }
    </div>
  `,
  imports: [MatIcon],
  host: {
    class: 'dbx-list-title-group-header dbx-firebase-notification-settings-list-group-header'
  }
})
export class DbxFirebaseNotificationSettingsListGroupHeaderComponent extends AbstractDbxListTitleGroupHeaderComponent<NotificationTemplateTypeInfoGroupKey, DbxFirebaseNotificationSettingsListGroupData> {
  readonly delegate = inject(DbxFirebaseNotificationSettingsListDelegate);
  readonly columnsSignal = computed(() => dbxFirebaseNotificationSettingsListColumns(this.delegate.columnsSignal()));
}
