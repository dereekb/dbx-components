import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';
import {
  hasNotificationDeliveryMethodOptIn,
  NotificationDeliveryMethod,
  type NotificationDeliveryMethodMap,
  type NotificationTemplateType,
  type NotificationUser,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag,
  toCanonicalNotificationDeliveryMethods,
  updateNotificationUserDefaultNotificationBoxRecipientConfig,
  type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams
} from '@dereekb/firebase';
import { isLoadingStateLoading, type ListLoadingState, successResult } from '@dereekb/rxjs';
import { type E164PhoneNumber, type Maybe, mergeObjects } from '@dereekb/util';
import { map, type Observable, shareReplay } from 'rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseNotificationSettingsListDelegate, type DbxFirebaseNotificationSettingsListItemValue } from '../component/notification.settings.list';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE,
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
 * Input for {@link DbxFirebaseNotificationUserSettingsStore.setCellValue}.
 */
export interface DbxFirebaseNotificationUserSettingsCellValue {
  /**
   * The template type of the cell's row.
   */
  readonly type: NotificationTemplateType;
  /**
   * The delivery method of the cell's column.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * The new value. Null clears the cell back to its default.
   */
  readonly value: Maybe<boolean>;
}

/**
 * Input for {@link DbxFirebaseNotificationUserSettingsStore.setMethodEnabled}.
 */
export interface DbxFirebaseNotificationUserSettingsMethodEnabled {
  readonly method: NotificationDeliveryMethod;
  /**
   * Whether the method is on account-wide.
   */
  readonly enabled: boolean;
}

/**
 * State of a {@link DbxFirebaseNotificationUserSettingsStore}.
 */
export interface DbxFirebaseNotificationUserSettingsStoreState {
  /**
   * Config merged over the app's {@link DbxFirebaseNotificationUserSettingsConfig}.
   */
  readonly config?: Maybe<DbxFirebaseNotificationUserSettingsStoreConfig>;
  /**
   * Pending cell changes. Changes the saved config already has are dropped as each snapshot arrives.
   */
  readonly cellEdits: DbxFirebaseNotificationSettingsCellEdits;
  /**
   * Pending account-wide on/off changes, keyed by delivery method. Changes the saved config already has are dropped as each
   * snapshot arrives.
   */
  readonly methodEdits: NotificationDeliveryMethodMap<boolean>;
}

const INITIAL_STATE: DbxFirebaseNotificationUserSettingsStoreState = {
  cellEdits: {},
  methodEdits: {}
};

/**
 * Store for editing the global notification settings (`gc`) of the NotificationUser in the ancestor
 * {@link NotificationUserDocumentStore}.
 *
 * Cell and switch changes are kept as pending edits, and {@link updateParams$} turns them into a single `gc` update for
 * `updateNotificationUser()`. Once a snapshot with the saved changes arrives, the edits it has are dropped, so a save needs no
 * cleanup. Provide a {@link DbxFirebaseNotificationUserSettingsStoreListDelegate} alongside it to drive
 * `dbx-firebase-notification-settings-list`.
 */
@Injectable()
export class DbxFirebaseNotificationUserSettingsStore extends ComponentStore<DbxFirebaseNotificationUserSettingsStoreState> {
  readonly notificationUserDocumentStore = inject(NotificationUserDocumentStore);
  readonly notificationTemplateService = inject(DbxFirebaseNotificationTemplateService);

  private readonly _authService = inject(DbxFirebaseAuthService);
  private readonly _appConfig = inject(DbxFirebaseNotificationUserSettingsConfig, { optional: true });

  constructor() {
    super(INITIAL_STATE);
    this._dropSavedEdits(this.savedGc$);
  }

  // MARK: Config
  /**
   * The app config merged with the config set by {@link setConfig}.
   */
  readonly config$: Observable<DbxFirebaseNotificationUserSettingsStoreConfig> = this.select((state) => state.config).pipe(
    map((config) => mergeObjects<DbxFirebaseNotificationUserSettingsStoreConfig>([this._appConfig, config])),
    shareReplay(1)
  );

  readonly columns$ = this.select(this.config$, (config) => dbxFirebaseNotificationSettingsDeliveryMethods(config));
  readonly switchableDeliveryMethods$ = this.select(this.config$, (config) => config.switchableDeliveryMethods ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS);
  readonly textMessageDisclosure$ = this.select(this.config$, (config) => config.textMessageDisclosure ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE);

  // MARK: Document
  /**
   * The loaded NotificationUser.
   */
  readonly notificationUser$: Observable<Maybe<NotificationUser>> = this.select(this.notificationUserDocumentStore.dataLoadingState$, (state) => state.value);

  readonly pageState$ = this.select(this.notificationUserDocumentStore.hasRef$, this.notificationUserDocumentStore.dataLoadingState$, (hasRef, state) => {
    let pageState: DbxFirebaseNotificationUserSettingsPageState;

    if (state.value) {
      pageState = 'ready';
    } else if (!hasRef || isLoadingStateLoading(state)) {
      pageState = 'loading';
    } else {
      pageState = 'missing';
    }

    return pageState;
  });

  /**
   * The saved global config.
   */
  readonly savedGc$ = this.select(this.notificationUser$, (notificationUser) => notificationUser?.gc);

  // MARK: List
  /**
   * The list rows. Only changes with the config, so cell changes never recreate the rows.
   */
  readonly items$ = this.select(this.config$, (config) => {
    const { groups, templateTypes, hiddenTemplateTypes, fallbackGroupBy, defaultGroup } = config;
    const typeInfos = this.notificationTemplateService.appNotificationTemplateTypeInfoRecordService.getAllKnownTemplateTypeInfo();
    return dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: dbxFirebaseNotificationSettingsDeliveryMethods(config), groups, templateTypes, hiddenTemplateTypes, fallbackGroupBy, defaultGroup });
  });

  /**
   * List state for `dbx-firebase-notification-settings-list`.
   */
  readonly listState$: Observable<ListLoadingState<DbxFirebaseNotificationSettingsListItemValue>> = this.select(this.items$, (items) => successResult(items));

  // MARK: Texts
  /**
   * The phone number texts are sent to (`gc.t`).
   *
   * Texts are opt-in: until the user saves a phone number for texts, texts are off and the text column is disabled. The
   * account phone number is only ever suggested, never used.
   */
  readonly textPhoneNumber$ = this.select(this.savedGc$, (gc) => gc?.t);

  /**
   * Whether texts can be turned on, which needs a saved phone number for texts.
   */
  readonly canEnableText$ = this.select(this.textPhoneNumber$, (textPhoneNumber) => textPhoneNumber != null);

  /**
   * Whether the text switch was turned on without a saved phone number for texts, and waits for one to be saved.
   */
  readonly awaitingTextPhoneNumber$ = this.select(
    this.canEnableText$,
    this.select((state) => state.methodEdits),
    (canEnableText, methodEdits) => !canEnableText && methodEdits[NotificationDeliveryMethod.TEXT] === true
  );

  /**
   * When the user consented to receiving texts. Only set while texts are on in the saved settings.
   */
  readonly textConsentAt$ = this.select(this.savedGc$, (gc) => (gc?.t != null && hasNotificationDeliveryMethodOptIn(gc, NotificationDeliveryMethod.TEXT) ? gc.tcat : undefined));

  /**
   * The account phone number to suggest for texts. Only the signed-in user's own phone number is known, so it is only set
   * when the NotificationUser is theirs, unless the config sets `authPhoneNumber`.
   */
  readonly authPhoneNumber$ = this.select(this.config$, this.notificationUser$, this._authService.currentAuthUser$, (config, notificationUser, authUser) => {
    let authPhoneNumber = config.authPhoneNumber;

    if (authPhoneNumber == null && notificationUser != null && authUser?.uid === notificationUser.uid) {
      authPhoneNumber = authUser.phoneNumber as Maybe<E164PhoneNumber>;
    }

    return authPhoneNumber;
  });

  // MARK: Delivery Methods
  /**
   * Account-wide disabled delivery methods in the saved settings.
   */
  readonly savedDisabledDeliveryMethods$ = this.select(this.savedGc$, (gc) => toCanonicalNotificationDeliveryMethods(gc?.dm));

  /**
   * Account-wide disabled delivery methods once the pending changes are saved.
   *
   * Texts are only turned on by saving a phone number for texts, so text switch changes are ignored until one is saved.
   */
  readonly nextDisabledDeliveryMethods$ = this.select(
    this.savedDisabledDeliveryMethods$,
    this.select((state) => state.methodEdits),
    this.canEnableText$,
    (savedDisabled, methodEdits, canEnableText) => {
      const disabled = new Set(savedDisabled);

      (Object.entries(methodEdits) as [NotificationDeliveryMethod, boolean][]).forEach(([method, enabled]) => {
        if (method !== NotificationDeliveryMethod.TEXT || canEnableText) {
          if (enabled) {
            disabled.delete(method);
          } else {
            disabled.add(method);
          }
        }
      });

      return toCanonicalNotificationDeliveryMethods(disabled);
    }
  );

  /**
   * Account-wide disabled delivery methods as shown, including pending changes. Texts show as off until a phone number for texts is saved.
   */
  readonly disabledDeliveryMethods$ = this.select(this.nextDisabledDeliveryMethods$, this.canEnableText$, (nextDisabled, canEnableText) => (canEnableText ? nextDisabled : toCanonicalNotificationDeliveryMethods([...nextDisabled, NotificationDeliveryMethod.TEXT])));

  readonly deliveryMethodSwitches$: Observable<DbxFirebaseNotificationUserSettingsDeliveryMethodSwitch[]> = this.select(
    this.select({ methods: this.switchableDeliveryMethods$, disabled: this.disabledDeliveryMethods$, nextDisabled: this.nextDisabledDeliveryMethods$, savedDisabled: this.savedDisabledDeliveryMethods$, awaitingTextPhoneNumber: this.awaitingTextPhoneNumber$ }),
    ({ methods, disabled, nextDisabled, savedDisabled, awaitingTextPhoneNumber }) =>
      methods.map((method) => {
        const awaitingPhoneNumber = method === NotificationDeliveryMethod.TEXT && awaitingTextPhoneNumber;

        return {
          method,
          enabled: awaitingPhoneNumber || !disabled.includes(method),
          modified: nextDisabled.includes(method) !== savedDisabled.includes(method),
          awaitingPhoneNumber
        };
      })
  );

  /**
   * Whether the phone number for texts shows. It shows while the text switch is on, including while it waits for a phone
   * number, and always when texts have no switch, since saving a phone number is then the only way to turn texts on.
   */
  readonly textPhoneNumberFormOpen$ = this.select(this.select({ columns: this.columns$, switchable: this.switchableDeliveryMethods$, disabled: this.disabledDeliveryMethods$, awaitingTextPhoneNumber: this.awaitingTextPhoneNumber$ }), ({ columns, switchable, disabled, awaitingTextPhoneNumber }) => {
    const textSwitchOn = awaitingTextPhoneNumber || !disabled.includes(NotificationDeliveryMethod.TEXT);
    return columns.includes(NotificationDeliveryMethod.TEXT) && (!switchable.includes(NotificationDeliveryMethod.TEXT) || textSwitchOn);
  });

  // MARK: Cells
  readonly cellStates$ = this.select(this.select({ items: this.items$, deliveryMethods: this.columns$, gc: this.savedGc$, edits: this.select((state) => state.cellEdits), disabledDeliveryMethods: this.disabledDeliveryMethods$ }), (input) => dbxFirebaseNotificationSettingsCellStates(input));

  /**
   * Whether every cell and switch is disabled, which is until the NotificationUser is loaded.
   */
  readonly disabled$ = this.select(this.pageState$, (pageState) => pageState !== 'ready');

  // MARK: Changes
  /**
   * The `gc` update params for the pending changes, or undefined when nothing changed.
   */
  readonly updateParams$ = this.select(
    this.savedGc$,
    this.select((state) => state.cellEdits),
    this.nextDisabledDeliveryMethods$,
    (gc, edits, disabledDeliveryMethods) => dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc, edits, disabledDeliveryMethods })
  );

  readonly isModified$ = this.select(this.updateParams$, (params) => params != null);

  /**
   * Whether saving the pending changes opts into texts for the first time, which records the user's consent.
   */
  readonly enablesText$ = this.select(this.savedGc$, this.updateParams$, (gc, params) => !hasNotificationDeliveryMethodOptIn(gc, NotificationDeliveryMethod.TEXT) && params != null && hasNotificationDeliveryMethodOptIn(applyGcUpdateParams(gc, params), NotificationDeliveryMethod.TEXT));

  // MARK: State Changes
  /**
   * Sets the config merged over the app config. Pass an observable, such as a component input, to follow its changes.
   */
  readonly setConfig = this.updater((state, config: Maybe<DbxFirebaseNotificationUserSettingsStoreConfig>) => ({ ...state, config }));

  /**
   * Sets a cell's pending value. A value equal to the saved value is not a change.
   */
  readonly setCellValue = this.updater((state, cell: DbxFirebaseNotificationUserSettingsCellValue) => ({
    ...state,
    cellEdits: { ...state.cellEdits, [cell.type]: { ...state.cellEdits[cell.type], [cell.method]: cell.value ?? null } }
  }));

  /**
   * Turns a delivery method on or off account-wide. Setting it back to its saved state is not a change.
   *
   * Without a saved phone number for texts, turning texts on only opens the phone number form. Texts turn on once a phone
   * number for texts is saved, such as with `dbxFirebaseNotificationUserTextPhoneNumberUpdateParams()`.
   */
  readonly setMethodEnabled = this.updater((state, change: DbxFirebaseNotificationUserSettingsMethodEnabled) => ({ ...state, methodEdits: { ...state.methodEdits, [change.method]: change.enabled } }));

  /**
   * Discards all pending changes.
   */
  readonly reset = this.updater((state) => ({ ...state, cellEdits: {}, methodEdits: {} }));

  /**
   * Drops the pending edits the saved config already has.
   */
  private readonly _dropSavedEdits = this.updater((state, gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>) => ({
    ...state,
    cellEdits: unsavedCellEdits(state.cellEdits, gc),
    methodEdits: unsavedMethodEdits(state.methodEdits, gc)
  }));
}

/**
 * {@link DbxFirebaseNotificationSettingsListDelegate} for `dbx-firebase-notification-settings-list` that reads from and
 * writes to the ancestor {@link DbxFirebaseNotificationUserSettingsStore}.
 */
@Injectable()
export class DbxFirebaseNotificationUserSettingsStoreListDelegate extends DbxFirebaseNotificationSettingsListDelegate {
  readonly store = inject(DbxFirebaseNotificationUserSettingsStore);

  readonly columnsSignal = toSignal(this.store.columns$, { initialValue: [] });
  readonly cellStatesSignal = toSignal(this.store.cellStates$, { initialValue: {} });
  readonly disabledSignal = toSignal(this.store.disabled$, { initialValue: true });

  setCellValue(type: NotificationTemplateType, method: NotificationDeliveryMethod, value: Maybe<boolean>): void {
    this.store.setCellValue({ type, method, value });
  }
}

/**
 * Returns the cell edits whose value differs from the saved config.
 *
 * @param cellEdits - The pending cell edits.
 * @param gc - The saved global config.
 * @returns The cell edits not yet saved.
 */
function unsavedCellEdits(cellEdits: DbxFirebaseNotificationSettingsCellEdits, gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>): DbxFirebaseNotificationSettingsCellEdits {
  const result: DbxFirebaseNotificationSettingsCellEdits = {};

  Object.entries(cellEdits).forEach(([type, typeEdits]) => {
    (Object.entries(typeEdits) as [NotificationDeliveryMethod, Maybe<boolean>][]).forEach(([method, value]) => {
      if ((value ?? null) !== (readNotificationDeliveryMethodFlag(gc?.c?.[type], method) ?? null)) {
        result[type] = { ...result[type], [method]: value };
      }
    });
  });

  return result;
}

/**
 * Returns the delivery method edits whose on/off state differs from the saved config. Texts count as off in the saved config
 * until it has a phone number for texts, so turning texts on waits for the phone number to be saved.
 *
 * @param methodEdits - The pending delivery method edits.
 * @param gc - The saved global config.
 * @returns The delivery method edits not yet saved.
 */
function unsavedMethodEdits(methodEdits: NotificationDeliveryMethodMap<boolean>, gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>): NotificationDeliveryMethodMap<boolean> {
  const savedDisabled = new Set(toCanonicalNotificationDeliveryMethods(gc?.dm));
  const result: NotificationDeliveryMethodMap<boolean> = {};

  (Object.entries(methodEdits) as [NotificationDeliveryMethod, boolean][]).forEach(([method, enabled]) => {
    const savedEnabled = !savedDisabled.has(method) && (method !== NotificationDeliveryMethod.TEXT || gc?.t != null);

    if (enabled !== savedEnabled) {
      result[method] = enabled;
    }
  });

  return result;
}

function applyGcUpdateParams(gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>, params: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams): NotificationUserDefaultNotificationBoxRecipientConfig {
  return updateNotificationUserDefaultNotificationBoxRecipientConfig({ ...gc, c: gc?.c ?? {} }, params);
}
