import { Component, computed, forwardRef, input, linkedSignal, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonToggle, type MatButtonToggleChange, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { type Maybe } from '@dereekb/util';
import { type DbxFirebaseNotificationBoxSettingsMode, type DbxFirebaseNotificationUserSettingsNotificationBoxConfig, dbxFirebaseNotificationUserSettingsTexts } from '../service/notification.settings';
import { DbxFirebaseNotificationBoxContext } from '../store/notification.box.context';

/**
 * Tooltip of a {@link DbxFirebaseNotificationBoxContextToggleComponent}'s toggle while a view inside it has pending changes.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_CONTEXT_TOGGLE_LOCKED_TOOLTIP = 'Save or discard your changes before switching.';

/**
 * Config for {@link DbxFirebaseNotificationBoxContextToggleComponent}. The component's individual inputs take precedence.
 */
export interface DbxFirebaseNotificationBoxContextToggleComponentConfig {
  /**
   * The NotificationBox the context is about.
   */
  readonly notificationBox?: Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>;
  /**
   * Whether the context starts on. True by default.
   */
  readonly enabled?: Maybe<boolean>;
  /**
   * Label of the option that edits the box's settings. Defaults to "This {modelName}", or "Only here" when the box's model has no name.
   */
  readonly boxLabel?: Maybe<string>;
  /**
   * Label of the option that edits the global settings. Defaults to "All {modelPluralName}", or "Everywhere" when the box's model has no name.
   */
  readonly globalLabel?: Maybe<string>;
}

type DbxFirebaseNotificationBoxContextToggleValue = 'box' | 'global';

/**
 * Wraps a view, such as `dbx-firebase-notification-user-settings`, and provides a {@link DbxFirebaseNotificationBoxContext} to it. Its
 * toggle switches the view between the NotificationBox's settings and the user's global settings for the same template types.
 *
 * The toggle is locked while a view inside reports pending changes through {@link DbxFirebaseNotificationBoxContext.setLocked}.
 *
 * Only useful in `perBox` mode (see {@link DbxFirebaseNotificationBoxSettingsMode}), where it lets the user reach the global settings that
 * override the box's settings. In the default `global` mode, the settings for a box already edit the global settings, so the toggle has no effect.
 *
 * @example
 * ```html
 * <dbx-firebase-notification-box-context-toggle [notificationBox]="{ modelKey: guestbookKey, modelName: 'guestbook' }">
 *   <dbx-firebase-notification-user-settings></dbx-firebase-notification-user-settings>
 * </dbx-firebase-notification-box-context-toggle>
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-box-context-toggle',
  template: `
    <div class="dbx-firebase-notification-box-context-toggle-bar dbx-pb3">
      <!-- the tooltip is on the wrapper, since a disabled toggle does not receive hover events -->
      <span [matTooltip]="lockedTooltip" [matTooltipDisabled]="!lockedSignal()">
        <mat-button-toggle-group [value]="valueSignal()" [disabled]="lockedSignal()" (change)="onToggleChange($event)" aria-label="Which notification settings to edit" hideSingleSelectionIndicator>
          <mat-button-toggle value="box">{{ boxLabelSignal() }}</mat-button-toggle>
          <mat-button-toggle value="global">{{ globalLabelSignal() }}</mat-button-toggle>
        </mat-button-toggle-group>
      </span>
    </div>
    <ng-content></ng-content>
  `,
  host: {
    class: 'd-block dbx-firebase-notification-box-context-toggle'
  },
  imports: [MatButtonToggleGroup, MatButtonToggle, MatTooltip],
  // providers (not viewProviders), so the projected content resolves the context
  providers: [{ provide: DbxFirebaseNotificationBoxContext, useExisting: forwardRef(() => DbxFirebaseNotificationBoxContextToggleComponent) }]
})
export class DbxFirebaseNotificationBoxContextToggleComponent extends DbxFirebaseNotificationBoxContext {
  readonly config = input<Maybe<DbxFirebaseNotificationBoxContextToggleComponentConfig>>();

  readonly notificationBox = input<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>>();
  /**
   * Whether the context starts on. True by default.
   */
  readonly enabled = input<Maybe<boolean>>();
  readonly boxLabel = input<Maybe<string>>();
  readonly globalLabel = input<Maybe<string>>();

  readonly lockedTooltip = DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_CONTEXT_TOGGLE_LOCKED_TOOLTIP;

  readonly notificationBoxSignal = computed(() => {
    const config = this.config();
    return this.notificationBox() ?? config?.notificationBox;
  });
  readonly textsSignal = computed(() => dbxFirebaseNotificationUserSettingsTexts({ notificationBox: this.notificationBoxSignal() ?? {}, hasToggle: true }));
  readonly boxLabelSignal = computed(() => {
    const config = this.config();
    const texts = this.textsSignal();
    return this.boxLabel() ?? config?.boxLabel ?? texts.boxScopeLabel;
  });
  readonly globalLabelSignal = computed(() => {
    const config = this.config();
    const texts = this.textsSignal();
    return this.globalLabel() ?? config?.globalLabel ?? texts.globalScopeLabel;
  });

  /**
   * Whether the context is on. Starts from the `enabled` input, then follows the toggle.
   */
  readonly enabledSignal = linkedSignal(() => this.enabled() ?? this.config()?.enabled ?? true);
  readonly lockedSignal = signal(false);
  readonly valueSignal = computed<DbxFirebaseNotificationBoxContextToggleValue>(() => (this.enabledSignal() ? 'box' : 'global'));

  readonly notificationBox$ = toObservable(this.notificationBoxSignal);
  readonly enabled$ = toObservable(this.enabledSignal);

  setLocked(locked: boolean): void {
    this.lockedSignal.set(locked);
  }

  setEnabled(enabled: boolean): void {
    this.enabledSignal.set(enabled);
  }

  onToggleChange(event: MatButtonToggleChange): void {
    this.setEnabled((event.value as DbxFirebaseNotificationBoxContextToggleValue) === 'box');
  }
}
