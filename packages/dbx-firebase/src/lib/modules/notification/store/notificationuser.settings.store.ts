import { computed, inject, Injectable, isSignal, type Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  hasNotificationDeliveryMethodOptIn,
  NotificationDeliveryMethod,
  type NotificationTemplateType,
  type NotificationUser,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  type OnCallCreateModelResult,
  readNotificationDeliveryMethodFlag,
  toCanonicalNotificationDeliveryMethods,
  updateNotificationUserDefaultNotificationBoxRecipientConfig,
  type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams
} from '@dereekb/firebase';
import { filterMaybe, isLoadingStateFinishedLoading, isLoadingStateLoading, isLoadingStateWithError, type ListLoadingState, type LoadingState, successResult } from '@dereekb/rxjs';
import { type E164PhoneNumber, type Maybe, mergeObjects } from '@dereekb/util';
import { defer, finalize, first, type Observable, of, switchMap, tap } from 'rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { type DbxFirebaseNotificationSettingsListDelegate, type DbxFirebaseNotificationSettingsListItemValue } from '../component/notification.settings.list';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS,
  type DbxFirebaseNotificationSettingsCellEdits,
  dbxFirebaseNotificationSettingsCellStates,
  dbxFirebaseNotificationSettingsDeliveryMethods,
  dbxFirebaseNotificationSettingsListItemValues,
  dbxFirebaseNotificationUserGlobalConfigUpdateParams,
  DbxFirebaseNotificationUserSettingsConfig
} from '../service/notification.settings';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { NotificationUserDocumentStore } from './notificationuser.document.store';

/**
 * Configuration for a {@link DbxFirebaseNotificationUserSettingsStore}. Merged over the app's {@link DbxFirebaseNotificationUserSettingsConfig}.
 */
export interface DbxFirebaseNotificationUserSettingsStoreConfig extends DbxFirebaseNotificationUserSettingsConfig {
  /**
   * Account phone number, suggested as the placeholder of the phone number for texts. Texts are opt-in, so it is never used
   * to send texts until the user saves it as their phone number for texts.
   *
   * Defaults to the signed-in user's phone number, but only when the NotificationUser being edited is theirs.
   */
  readonly authPhoneNumber?: Maybe<E164PhoneNumber>;
}

/**
 * State of the settings page.
 *
 * - `loading` — the NotificationUser is loading
 * - `missing` — the NotificationUser does not exist yet
 * - `ready` — the NotificationUser is loaded
 */
export type DbxFirebaseNotificationUserSettingsPageState = 'loading' | 'missing' | 'ready';

/**
 * An account-wide on/off switch for a delivery method.
 */
export interface DbxFirebaseNotificationUserSettingsDeliveryMethodSwitch {
  readonly method: NotificationDeliveryMethod;
  /**
   * Whether the method is on, including pending changes.
   */
  readonly enabled: boolean;
  /**
   * Whether the switch has a pending change.
   */
  readonly modified: boolean;
  /**
   * Whether the switch was turned on but waits for a phone number to be saved before the method is turned on. Only set for texts.
   */
  readonly awaitingPhoneNumber: boolean;
}

/**
 * Saved global config shown until the next snapshot arrives, so the view does not flicker back to the old values after a save.
 */
interface DbxFirebaseNotificationUserSettingsOptimisticGc {
  /**
   * The snapshot the save was made against. The overlay is dropped once the NotificationUser changes from it.
   */
  readonly basedOn: NotificationUser;
  readonly gc: NotificationUserDefaultNotificationBoxRecipientConfig;
}

/**
 * Signal-based store for editing the global notification settings (`gc`) of the NotificationUser in the ancestor
 * {@link NotificationUserDocumentStore}.
 *
 * Cell and switch changes are kept as pending edits and sent together by {@link save}. Implements the
 * {@link DbxFirebaseNotificationSettingsListDelegate}, so it can be provided to `dbx-firebase-notification-settings-list`.
 */
@Injectable()
export class DbxFirebaseNotificationUserSettingsStore implements DbxFirebaseNotificationSettingsListDelegate {
  readonly notificationUserDocumentStore = inject(NotificationUserDocumentStore);
  readonly notificationTemplateService = inject(DbxFirebaseNotificationTemplateService);

  private readonly _authService = inject(DbxFirebaseAuthService);
  private readonly _appConfig = inject(DbxFirebaseNotificationUserSettingsConfig, { optional: true });

  private readonly _inputConfig = signal<Signal<Maybe<Partial<DbxFirebaseNotificationUserSettingsStoreConfig>>>>(signal(undefined));
  private readonly _edits = signal<DbxFirebaseNotificationSettingsCellEdits>({});
  private readonly _pendingDisabledDeliveryMethods = signal<Maybe<NotificationDeliveryMethod[]>>(undefined);
  private readonly _optimisticGc = signal<Maybe<DbxFirebaseNotificationUserSettingsOptimisticGc>>(undefined);
  private readonly _textPhoneNumberFormOpen = signal(false);
  private readonly _saving = signal(false);

  private readonly _hasRefSignal = toSignal(this.notificationUserDocumentStore.hasRef$, { initialValue: false });
  private readonly _dataLoadingStateSignal = toSignal(this.notificationUserDocumentStore.dataLoadingState$);
  private readonly _currentAuthUserSignal = toSignal(this._authService.currentAuthUser$);

  // MARK: Config
  /**
   * The app config merged with the config set by {@link setConfig}.
   */
  readonly configSignal = computed(() => mergeObjects<DbxFirebaseNotificationUserSettingsStoreConfig>([this._appConfig, this._inputConfig()()]));

  readonly columnsSignal = computed(() => dbxFirebaseNotificationSettingsDeliveryMethods(this.configSignal()));
  readonly switchableDeliveryMethodsSignal = computed(() => this.configSignal().switchableDeliveryMethods ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS);

  // MARK: Document
  /**
   * The loaded NotificationUser.
   */
  readonly notificationUserSignal = computed(() => this._dataLoadingStateSignal()?.value);

  readonly pageStateSignal = computed<DbxFirebaseNotificationUserSettingsPageState>(() => {
    const state = this._dataLoadingStateSignal();
    const hasRef = this._hasRefSignal();
    let pageState: DbxFirebaseNotificationUserSettingsPageState;

    if (state?.value) {
      pageState = 'ready';
    } else if (state == null || !hasRef || isLoadingStateLoading(state)) {
      pageState = 'loading';
    } else {
      pageState = 'missing';
    }

    return pageState;
  });

  /**
   * The saved global config, or the optimistic result of the last save until the next snapshot arrives.
   */
  readonly savedGcSignal = computed(() => {
    const notificationUser = this.notificationUserSignal();
    const optimistic = this._optimisticGc();
    return optimistic != null && optimistic.basedOn === notificationUser ? optimistic.gc : notificationUser?.gc;
  });

  // MARK: List
  readonly itemsSignal = computed<DbxFirebaseNotificationSettingsListItemValue[]>(() => {
    const { hiddenTemplateTypes, fallbackGroupBy, defaultGroup } = this.configSignal();
    const typeInfos = this.notificationTemplateService.appNotificationTemplateTypeInfoRecordService.getAllKnownTemplateTypeInfo();
    return dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: this.columnsSignal(), hiddenTemplateTypes, fallbackGroupBy, defaultGroup });
  });

  /**
   * List state for `dbx-firebase-notification-settings-list`. Only changes with the config, so cell changes never recreate the rows.
   */
  readonly listStateSignal = computed<ListLoadingState<DbxFirebaseNotificationSettingsListItemValue>>(() => successResult(this.itemsSignal()));

  /**
   * The phone number texts are sent to (`gc.t`).
   *
   * Texts are opt-in: until the user saves a phone number for texts, texts are off and the text column is disabled. The
   * account phone number is only ever suggested, never used.
   */
  readonly textPhoneNumberSignal = computed(() => this.savedGcSignal()?.t);

  /**
   * Whether texts can be turned on, which needs a saved phone number for texts.
   */
  readonly canEnableTextSignal = computed(() => this.textPhoneNumberSignal() != null);

  /**
   * Whether the phone number form is open: texts are on, or the text switch was turned on and waits for a phone number.
   */
  readonly textPhoneNumberFormOpenSignal = computed(() => {
    const canEnableText = this.canEnableTextSignal();
    const formOpen = this._textPhoneNumberFormOpen();
    const disabled = this.disabledDeliveryMethodsSignal();
    return canEnableText ? !disabled.includes(NotificationDeliveryMethod.TEXT) : formOpen;
  });

  /**
   * The pending account-wide disabled delivery methods to save, or undefined when unchanged. Drops turning texts on while
   * {@link canEnableTextSignal} is false.
   */
  private readonly _effectivePendingDisabledDeliveryMethodsSignal = computed(() => {
    const pending = this._pendingDisabledDeliveryMethods();
    const canEnableText = this.canEnableTextSignal();
    const savedDm = toCanonicalNotificationDeliveryMethods(this.savedGcSignal()?.dm);
    let result = pending;

    if (pending != null && !canEnableText && savedDm.includes(NotificationDeliveryMethod.TEXT) && !pending.includes(NotificationDeliveryMethod.TEXT)) {
      const next = toCanonicalNotificationDeliveryMethods([...pending, NotificationDeliveryMethod.TEXT]);
      result = next.join(',') === savedDm.join(',') ? undefined : next;
    }

    return result;
  });

  /**
   * Account-wide disabled delivery methods once the pending changes are saved.
   */
  private readonly _nextDisabledDeliveryMethodsSignal = computed(() => {
    const pending = this._effectivePendingDisabledDeliveryMethodsSignal();
    const savedGc = this.savedGcSignal();
    return pending ?? toCanonicalNotificationDeliveryMethods(savedGc?.dm);
  });

  /**
   * Account-wide disabled delivery methods as shown, including pending changes. Texts show as off while they can't be turned on.
   */
  readonly disabledDeliveryMethodsSignal = computed(() => {
    const next = this._nextDisabledDeliveryMethodsSignal();
    const canEnableText = this.canEnableTextSignal();
    return canEnableText ? next : toCanonicalNotificationDeliveryMethods([...next, NotificationDeliveryMethod.TEXT]);
  });

  readonly cellStatesSignal = computed(() => dbxFirebaseNotificationSettingsCellStates({ items: this.itemsSignal(), deliveryMethods: this.columnsSignal(), gc: this.savedGcSignal(), edits: this._edits(), disabledDeliveryMethods: this.disabledDeliveryMethodsSignal() }));

  readonly savingSignal = this._saving.asReadonly();
  readonly disabledSignal = computed(() => {
    const saving = this._saving();
    const pageState = this.pageStateSignal();
    return saving || pageState !== 'ready';
  });

  readonly deliveryMethodSwitchesSignal = computed<DbxFirebaseNotificationUserSettingsDeliveryMethodSwitch[]>(() => {
    const shownDisabled = new Set(this.disabledDeliveryMethodsSignal());
    const nextDisabled = new Set(this._nextDisabledDeliveryMethodsSignal());
    const savedDisabled = new Set(this.savedGcSignal()?.dm ?? []);
    const canEnableText = this.canEnableTextSignal();
    const textPhoneNumberFormOpen = this._textPhoneNumberFormOpen();

    return this.switchableDeliveryMethodsSignal().map((method) => {
      const awaitingPhoneNumber = method === NotificationDeliveryMethod.TEXT && !canEnableText && textPhoneNumberFormOpen;

      return {
        method,
        enabled: awaitingPhoneNumber || !shownDisabled.has(method),
        modified: nextDisabled.has(method) !== savedDisabled.has(method),
        awaitingPhoneNumber
      };
    });
  });

  // MARK: Changes
  /**
   * The `gc` update params for the pending changes, or undefined when nothing changed.
   */
  readonly updateParamsSignal = computed(() => dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: this.savedGcSignal(), edits: this._edits(), disabledDeliveryMethods: this._effectivePendingDisabledDeliveryMethodsSignal() }));
  readonly isModifiedSignal = computed(() => this.updateParamsSignal() != null);

  /**
   * The global config after the pending changes are applied.
   */
  readonly nextGcSignal = computed(() => {
    const savedGc = this.savedGcSignal();
    const params = this.updateParamsSignal();
    return params ? applyGcUpdateParams(savedGc, params) : savedGc;
  });

  /**
   * Whether texts are opted into once the pending changes are saved.
   */
  readonly textOptInSignal = computed(() => hasNotificationDeliveryMethodOptIn(this.nextGcSignal(), NotificationDeliveryMethod.TEXT));

  /**
   * Whether texts are opted into in the saved settings.
   */
  readonly savedTextOptInSignal = computed(() => hasNotificationDeliveryMethodOptIn(this.savedGcSignal(), NotificationDeliveryMethod.TEXT));

  /**
   * Whether saving the pending changes opts into texts for the first time, which records the user's consent.
   */
  readonly enablesTextSignal = computed(() => {
    const textOptIn = this.textOptInSignal();
    const savedTextOptIn = this.savedTextOptInSignal();
    return textOptIn && !savedTextOptIn;
  });

  /**
   * When the user consented to receiving texts.
   */
  readonly textConsentAtSignal = computed(() => this.savedGcSignal()?.tcat);

  /**
   * The account phone number to suggest for texts. Only the signed-in user's own phone number is known, so it is only set
   * when the NotificationUser is theirs, unless the config sets `authPhoneNumber`.
   */
  readonly authPhoneNumberSignal = computed(() => {
    const notificationUser = this.notificationUserSignal();
    const authUser = this._currentAuthUserSignal();
    const configAuthPhoneNumber = this.configSignal().authPhoneNumber;
    return configAuthPhoneNumber ?? (notificationUser != null && authUser?.uid === notificationUser.id ? (authUser.phoneNumber as Maybe<E164PhoneNumber>) : undefined);
  });

  // MARK: Methods
  /**
   * Sets the config merged over the app config. Pass a signal, such as a component input, to follow its changes.
   *
   * @param config - The config, or a signal of it.
   */
  setConfig(config: Maybe<Partial<DbxFirebaseNotificationUserSettingsStoreConfig>> | Signal<Maybe<Partial<DbxFirebaseNotificationUserSettingsStoreConfig>>>): void {
    this._inputConfig.set(isSignal(config) ? config : signal(config));
  }

  /**
   * Sets a cell's pending value. Setting a cell back to its saved value clears the edit.
   *
   * @param type - The template type of the cell's row.
   * @param method - The delivery method of the cell's column.
   * @param value - The new value. Null clears the cell back to its default.
   */
  setCellValue(type: NotificationTemplateType, method: NotificationDeliveryMethod, value: Maybe<boolean>): void {
    const savedValue = readNotificationDeliveryMethodFlag(this.savedGcSignal()?.c?.[type], method) ?? null;
    const nextValue = value ?? null;

    this._edits.update((edits) => {
      const typeEdits = { ...edits[type] };
      const nextEdits = { ...edits };

      if (nextValue === savedValue) {
        delete typeEdits[method];
      } else {
        typeEdits[method] = nextValue;
      }

      if (Object.keys(typeEdits).length) {
        nextEdits[type] = typeEdits;
      } else {
        delete nextEdits[type];
      }

      return nextEdits;
    });
  }

  /**
   * Turns a delivery method on or off account-wide. Setting it back to its saved state clears the pending change.
   *
   * Without a saved phone number for texts, turning texts on only opens the phone number form. Texts turn on once the phone
   * number is saved with {@link saveTextPhoneNumber}.
   *
   * @param method - The delivery method.
   * @param enabled - Whether the method is on.
   */
  setMethodEnabled(method: NotificationDeliveryMethod, enabled: boolean): void {
    if (method === NotificationDeliveryMethod.TEXT && !this.canEnableTextSignal()) {
      this._textPhoneNumberFormOpen.set(enabled);
    } else {
      const disabled = new Set(this._nextDisabledDeliveryMethodsSignal());

      if (enabled) {
        disabled.delete(method);
      } else {
        disabled.add(method);
      }

      const next = toCanonicalNotificationDeliveryMethods(disabled);
      const saved = toCanonicalNotificationDeliveryMethods(this.savedGcSignal()?.dm);
      this._pendingDisabledDeliveryMethods.set(next.join(',') === saved.join(',') ? undefined : next);
    }
  }

  /**
   * Discards all pending changes.
   */
  reset(): void {
    this._edits.set({});
    this._pendingDisabledDeliveryMethods.set(undefined);
    this._textPhoneNumberFormOpen.set(false);
  }

  /**
   * Saves the pending changes with a single `updateNotificationUser({ gc })` call.
   *
   * On success the pending changes are cleared, and the saved values are shown until the next snapshot arrives.
   *
   * @param params - The update params to send. Defaults to {@link updateParamsSignal}.
   * @returns The loading state of the save.
   */
  save(params?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>): Observable<LoadingState<void>> {
    return defer(() => {
      const gc = params ?? this.updateParamsSignal();
      let result: Observable<LoadingState<void>>;

      if (gc) {
        const basedOn = this.notificationUserSignal();
        const savedGc = this.savedGcSignal();
        this._saving.set(true);

        result = this.notificationUserDocumentStore.updateNotificationUser({ gc }).pipe(
          tap((state) => {
            if (isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state)) {
              if (basedOn) {
                this._optimisticGc.set({ basedOn, gc: applyGcUpdateParams(savedGc, gc) });
              }

              this.reset();
            }
          }),
          finalize(() => this._saving.set(false))
        );
      } else {
        result = of(successResult(undefined));
      }

      return result;
    });
  }

  /**
   * Saves the phone number texts are sent to, and turns texts on. Saving the phone number is how the user opts into texts.
   *
   * Saved on its own, apart from the pending changes.
   *
   * @param phoneNumber - The phone number for texts.
   * @returns The loading state of the update.
   */
  saveTextPhoneNumber(phoneNumber: E164PhoneNumber): Observable<LoadingState<void>> {
    return defer(() => {
      const basedOn = this.notificationUserSignal();
      const savedGc = this.savedGcSignal();
      const savedDm = toCanonicalNotificationDeliveryMethods(savedGc?.dm);
      const dm = savedDm.filter((x) => x !== NotificationDeliveryMethod.TEXT);
      const gc: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams = { t: phoneNumber, ...(dm.length === savedDm.length ? {} : { dm: dm.length ? dm : null }) };

      return this.notificationUserDocumentStore.updateNotificationUser({ gc }).pipe(
        tap((state) => {
          if (isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state)) {
            // show the saved number and texts on until the next snapshot arrives
            if (basedOn) {
              this._optimisticGc.set({ basedOn, gc: applyGcUpdateParams(savedGc, gc) });
            }

            this._textPhoneNumberFormOpen.set(false);
          }
        })
      );
    });
  }

  /**
   * Creates the NotificationUser for the store's current id, which is the user's uid.
   *
   * @returns The loading state of the create.
   */
  createNotificationUser(): Observable<LoadingState<OnCallCreateModelResult>> {
    return this.notificationUserDocumentStore.currentId$.pipe(
      filterMaybe(),
      first(),
      switchMap((uid) => this.notificationUserDocumentStore.createNotificationUser({ uid }))
    );
  }
}

function applyGcUpdateParams(gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>, params: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams): NotificationUserDefaultNotificationBoxRecipientConfig {
  return updateNotificationUserDefaultNotificationBoxRecipientConfig({ ...gc, c: gc?.c ?? {} }, params);
}
