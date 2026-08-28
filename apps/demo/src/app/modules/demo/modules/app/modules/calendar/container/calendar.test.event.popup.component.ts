import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxActionModule, DbxButtonModule, DbxDialogModule, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { type DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DEMO_CALENDAR_TEST_EVENT_EXAMPLE_RECURRENCE_RULE, DemoCalendarTestEventFormComponent, type DemoCalendarTestEventFormValue, type ProfileDocumentStore } from 'demo-components';

export interface DemoCalendarTestEventPopupComponentConfig {
  readonly profileDocumentStore: ProfileDocumentStore;
  /**
   * Instant the form's "Starts At" field is seeded with, so the created series anchors inside the window
   * the user is currently looking at.
   */
  readonly defaultStartsAt: Date;
}

/**
 * Dialog for creating a recurring test event on the user's profile calendar.
 *
 * The rule is entered as raw text on purpose — the point of the form is to type an RRULE and see exactly
 * where its occurrences land on the calendar behind it.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <p class="dbx-note">Create a recurring test event and see where its occurrences land.</p>
      <div dbxAction dbxActionSnackbarError [dbxActionHandler]="handleCreateEvent" [dbxActionSuccessHandler]="handleSuccess">
        <demo-calendar-test-event-form dbxActionForm [dbxFormSource]="defaultValue"></demo-calendar-test-event-form>
        <p></p>
        <dbx-button [raised]="true" text="Create Recurring Event" dbxActionButton></dbx-button>
        <dbx-error dbxActionError></dbx-error>
      </div>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogModule, DbxActionModule, DbxButtonModule, DbxErrorComponent, DbxActionFormDirective, DbxFormSourceDirective, DemoCalendarTestEventFormComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoCalendarTestEventPopupComponent extends AbstractDialogDirective<unknown, DemoCalendarTestEventPopupComponentConfig> {
  readonly defaultValue: DemoCalendarTestEventFormValue = {
    startsAt: this.data.defaultStartsAt,
    durationMinutes: 60,
    recurrenceRule: DEMO_CALENDAR_TEST_EVENT_EXAMPLE_RECURRENCE_RULE
  };

  get profileDocumentStore(): ProfileDocumentStore {
    return this.data.profileDocumentStore;
  }

  static openPopup(matDialog: MatDialog, config: DemoCalendarTestEventPopupComponentConfig) {
    return matDialog.open(DemoCalendarTestEventPopupComponent, {
      data: config
    });
  }

  readonly handleCreateEvent: WorkUsingContext<DemoCalendarTestEventFormValue, void> = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.createTestCalendarEvent(value));
  };

  readonly handleSuccess: DbxActionSuccessHandlerFunction = () => {
    this.close();
  };
}
