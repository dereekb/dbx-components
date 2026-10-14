import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionValueStreamDirective } from '@dereekb/dbx-core';
import { DbxActionSnackbarErrorDirective, DbxActionTransitionSafetyDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective, DbxLoadingComponent } from '@dereekb/dbx-web';
import { type FirestoreModelKey, type UpdateNotificationTaskBotOptOutParams } from '@dereekb/firebase';
import { type IsModifiedFunction, type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of } from 'rxjs';
import { DbxFirebaseNotificationTaskBotSettingsStore } from '../store/notificationtaskbot.settings.store';

/**
 * Bot settings for the owner of a model's NotificationTaskBot: one switch per script group the owner can turn off.
 *
 * A switch that is on means the owner receives the group. Changes are pending until Save, which sends them in one
 * `updateNotificationTaskBot.optOut()` call. Only the bot's owner can change them.
 *
 * Place it where the owner manages the model: a user's own model (e.g. their profile) on their notification settings
 * page, and a shared model (e.g. a guestbook) on that model's own page.
 *
 * @example
 * ```html
 * <dbx-firebase-notification-task-bot-settings [modelKey]="profileKey"></dbx-firebase-notification-task-bot-settings>
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-task-bot-settings',
  template: `
    @switch (pageStateSignal()) {
      @case ('loading') {
        <dbx-loading [loading]="true" [linear]="true"></dbx-loading>
      }
      @case ('missing') {
        <dbx-content-pit>
          <p class="dbx-hint no-margin">There are no bot settings to change yet.</p>
        </dbx-content-pit>
      }
      @case ('error') {
        <dbx-content-pit>
          <p class="dbx-hint no-margin">The bot settings could not be loaded.</p>
          <dbx-button text="Retry" (buttonClick)="store.load()"></dbx-button>
        </dbx-content-pit>
      }
      @case ('ready') {
        @if (rowsSignal().length === 0) {
          <dbx-content-pit>
            <p class="dbx-hint no-margin">There are no bot settings you can change.</p>
          </dbx-content-pit>
        } @else {
          @for (row of rowsSignal(); track row.group.key) {
            <div class="dbx-firebase-notification-settings-row dbx-firebase-notification-task-bot-settings-row" [class.dbx-firebase-notification-task-bot-settings-row-modified]="row.modified">
              <div class="dbx-firebase-notification-settings-row-label">
                <span>{{ row.group.name }}</span>
                @if (row.group.description) {
                  <span class="dbx-hint dbx-small">{{ row.group.description }}</span>
                }
              </div>
              <mat-slide-toggle [checked]="!row.optedOut" [disabled]="disabledSignal()" [attr.aria-label]="row.group.name" (change)="store.setOptedOut({ key: row.group.key, optedOut: !$event.checked })"></mat-slide-toggle>
            </div>
          }
          <div class="dbx-flex-bar" dbxAction [dbxActionValueStream]="updateParams$" [dbxActionValueStreamIsModifiedValue]="isUpdateParamsModified" dbxActionEnforceModified dbxActionTransitionSafety="dialog" dbxActionSnackbarError [dbxActionHandler]="handleSave">
            <span class="dbx-spacer"></span>
            <dbx-button text="Discard" [disabled]="!isModifiedSignal()" (buttonClick)="store.reset()"></dbx-button>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-button dbxActionButton [raised]="true" color="primary" text="Save"></dbx-button>
          </div>
        }
      }
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-task-bot-settings'
  },
  imports: [
    MatSlideToggle,
    DbxActionDirective,
    DbxActionValueStreamDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionHandlerDirective,
    DbxActionButtonDirective,
    DbxActionSnackbarErrorDirective,
    DbxActionTransitionSafetyDirective,
    DbxButtonComponent,
    DbxButtonSpacerDirective,
    DbxContentPitDirective,
    DbxLoadingComponent
  ],
  providers: [DbxFirebaseNotificationTaskBotSettingsStore]
})
export class DbxFirebaseNotificationTaskBotSettingsComponent {
  readonly store = inject(DbxFirebaseNotificationTaskBotSettingsStore);

  /**
   * Key of the model the bot is attached to.
   */
  readonly modelKey = input<Maybe<FirestoreModelKey>>();

  readonly pageStateSignal = toSignal(this.store.pageState$, { initialValue: 'loading' });
  readonly rowsSignal = toSignal(this.store.rows$, { initialValue: [] });
  readonly isModifiedSignal = toSignal(this.store.isModified$, { initialValue: false });
  readonly disabledSignal = toSignal(this.store.disabled$, { initialValue: true });

  readonly updateParams$ = this.store.updateParams$;
  readonly isUpdateParamsModified: IsModifiedFunction<Maybe<UpdateNotificationTaskBotOptOutParams>> = (params) => of(params != null);

  // the store replaces the groups with the result and drops the saved edits
  readonly handleSave: WorkUsingContext<Maybe<UpdateNotificationTaskBotOptOutParams>> = (params, context) => {
    if (params) {
      context.startWorkingWithLoadingStateObservable(this.store.update(params));
    } else {
      context.reject();
    }
  };

  constructor() {
    this.store.setModelKey(toObservable(this.modelKey));
  }
}
