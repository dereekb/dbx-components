import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';
import {
  hasNotificationDeliveryMethodOptIn,
  type NotificationBoxId,
  NotificationBoxRecipientFlag,
  type NotificationBoxRecipientTemplateConfigRecord,
  NotificationDeliveryMethod,
  type NotificationDeliveryMethodMap,
  type NotificationTemplateType,
  type NotificationUser,
  type NotificationUserDefaultNotificationBoxRecipientConfig,
  type NotificationUserNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag,
  toCanonicalNotificationDeliveryMethods,
  updateNotificationUserDefaultNotificationBoxRecipientConfig,
  type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams
} from '@dereekb/firebase';
import { isLoadingStateLoading, type ListLoadingState, successResult } from '@dereekb/rxjs';
import { type E164PhoneNumber, type Maybe, mergeObjects } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, finalize, map, type Observable, of, shareReplay, skip, tap } from 'rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseNotificationSettingsListDelegate, type DbxFirebaseNotificationSettingsListItemValue } from '../component/notification.settings.list';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SWITCHABLE_DELIVERY_METHODS,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE,
  type DbxFirebaseNotificationBoxSettingsMode,
  type DbxFirebaseNotificationSettingsCellEdits,
  dbxFirebaseNotificationSettingsCellStates,
  dbxFirebaseNotificationSettingsDeliveryMethods,
  dbxFirebaseNotificationSettingsListItemValues,
  DbxFirebaseNotificationUserSettingsConfig,
  type DbxFirebaseNotificationUserSettingsNotificationBoxConfig,
  type DbxFirebaseNotificationUserSettingsNotificationBoxEnabledChange,
  dbxFirebaseNotificationUserSettingsNotificationBoxTarget,
  type DbxFirebaseNotificationUserSettingsNotificationBoxTarget,
  dbxFirebaseNotificationUserSettingsTexts,
  dbxFirebaseNotificationUserSettingsUpdateParams
} from '../service/notification.settings';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { DbxFirebaseNotificationBoxContext } from './notification.box.context';
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
  /**
   * The NotificationBox to edit the user's settings for. When set, only the template types of the box's model are shown, and a switch turns all
   * of the box's notifications on or off for the user. What the cells edit depends on the {@link DbxFirebaseNotificationBoxSettingsMode}:
   * - `global` — the cells edit the user's global settings (`gc`) for those types, which apply to every box of that kind.
   * - `perBox` — the cells read from and save to the user's `bc` entry for the box, and a cell `gc` sets shows as overridden.
   *
   * An ancestor {@link DbxFirebaseNotificationBoxContext} takes precedence.
   */
  readonly notificationBox?: Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>;
}

/**
 * State of the settings page.
 *
 * - `loading` — the NotificationUser is loading
 * - `missing` — the NotificationUser does not exist yet
 * - `notRecipient` — the targeted NotificationBox does not send to the user: they have no `bc` entry for it, they removed themselves (`rm`), or they have no NotificationUser
 * - `ready` — the NotificationUser is loaded
 */
export type DbxFirebaseNotificationUserSettingsPageState = 'loading' | 'missing' | 'notRecipient' | 'ready';

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
 * The switch that turns all of a NotificationBox's notifications on or off for the user.
 *
 * Turning it off opts the user out of the box (`bc[].f`), which stops every notification from it, whatever the global settings say.
 */
export interface DbxFirebaseNotificationUserSettingsBoxSwitch {
  /**
   * Whether the user gets the box's notifications, including the pending change.
   */
  readonly enabled: boolean;
  /**
   * Whether the switch has a pending change.
   */
  readonly modified: boolean;
  /**
   * Whether the box turned the user's notifications off (they are excluded, or the box disabled them), so the switch can't turn them on.
   */
  readonly locked: boolean;
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
  /**
   * Pending value of the targeted NotificationBox's switch. Dropped once the saved config has it, and cleared when the targeted box changes.
   */
  readonly boxEnabledEdit?: Maybe<boolean>;
}

const INITIAL_STATE: DbxFirebaseNotificationUserSettingsStoreState = {
  cellEdits: {},
  methodEdits: {}
};

/**
 * Store for editing the notification settings of the NotificationUser in the ancestor {@link NotificationUserDocumentStore}: their global
 * settings (`gc`), or their `bc` entry for one NotificationBox. A box is targeted when the config sets `notificationBox`, or an ancestor
 * {@link DbxFirebaseNotificationBoxContext} provides one.
 *
 * With a targeted box, {@link boxSwitch$} turns all of the box's notifications on or off, and the
 * {@link DbxFirebaseNotificationBoxSettingsMode} decides what the cells edit: `gc` in `global` mode (the default), or the box's `bc` entry in
 * `perBox` mode while the box context is on. The global settings override a box's per-type settings, so an app should keep its per-type
 * settings in one place. See {@link DbxFirebaseNotificationBoxSettingsMode}.
 *
 * Cell and switch changes are kept as pending edits, and {@link updateParams$} turns them into a single update for
 * `updateNotificationUser()`. The store never saves. Once a snapshot with the saved changes arrives, the edits it has are dropped, so a save
 * needs no cleanup. Provide a {@link DbxFirebaseNotificationUserSettingsStoreListDelegate} alongside it to drive
 * `dbx-firebase-notification-settings-list`.
 */
@Injectable()
export class DbxFirebaseNotificationUserSettingsStore extends ComponentStore<DbxFirebaseNotificationUserSettingsStoreState> {
  readonly notificationUserDocumentStore = inject(NotificationUserDocumentStore);
  readonly notificationTemplateService = inject(DbxFirebaseNotificationTemplateService);

  private readonly _authService = inject(DbxFirebaseAuthService);
  private readonly _appConfig = inject(DbxFirebaseNotificationUserSettingsConfig, { optional: true });
  private readonly _notificationBoxContext = inject(DbxFirebaseNotificationBoxContext, { optional: true });

  constructor() {
    super(INITIAL_STATE);
    this._dropSavedEdits(this.select({ gc: this.savedGc$, c: this.savedTemplateConfigs$ }));
    this._dropSavedBoxEnabledEdit(this.savedTargetBoxConfig$);
    this._clearCellEditsOnTargetChange(this.notificationBoxId$);
    this._clearBoxEnabledEditOnTargetChange(this.select(this.notificationBoxTarget$, (target) => target?.notificationBoxId));

    if (this._notificationBoxContext) {
      this._reportLocked(this.hasCellEdits$);
    }
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

  /**
   * Where the per-type settings live. See {@link DbxFirebaseNotificationBoxSettingsMode}.
   */
  readonly notificationBoxSettingsMode$ = this.select(this.config$, (config) => config.notificationBoxSettingsMode ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE);

  // MARK: NotificationBox
  /**
   * Whether an ancestor {@link DbxFirebaseNotificationBoxContext} decides the targeted box and whether it is active.
   */
  readonly hasNotificationBoxContext = this._notificationBoxContext != null;

  /**
   * The targeted NotificationBox's config, from the ancestor {@link DbxFirebaseNotificationBoxContext} when it sets one, otherwise from the config.
   */
  readonly notificationBox$: Observable<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>> = combineLatest([this.config$, this._notificationBoxContext?.notificationBox$ ?? of(undefined)]).pipe(
    map(([config, contextNotificationBox]) => contextNotificationBox ?? config.notificationBox),
    shareReplay(1)
  );

  /**
   * The targeted NotificationBox. Decides the rows, and stays set while the box context is off so the rows do not change.
   */
  readonly notificationBoxTarget$: Observable<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxTarget>> = this.notificationBox$.pipe(
    map((notificationBox) => dbxFirebaseNotificationUserSettingsNotificationBoxTarget(notificationBox)),
    distinctUntilChanged((a, b) => a?.notificationBoxId === b?.notificationBoxId && a?.modelKey === b?.modelKey),
    shareReplay(1)
  );

  /**
   * Whether a NotificationBox is targeted.
   */
  readonly hasNotificationBoxTarget$ = this.select(this.notificationBoxTarget$, (target) => target != null);

  /**
   * The NotificationBox whose settings the cells edit. In `perBox` mode, it is the targeted box while the box context is on, or always when
   * there is no context. Undefined in `global` mode, where the cells always edit the global settings (`gc`).
   */
  readonly activeNotificationBoxTarget$ = this.select(this.notificationBoxTarget$, this.notificationBoxSettingsMode$, this._notificationBoxContext?.enabled$ ?? of(true), (target, mode, enabled) => (mode === 'perBox' && enabled ? target : undefined));

  /**
   * Id of the NotificationBox whose settings the cells edit.
   */
  readonly notificationBoxId$: Observable<Maybe<NotificationBoxId>> = this.select(this.activeNotificationBoxTarget$, (target) => target?.notificationBoxId);

  /**
   * The texts that describe the settings.
   */
  readonly texts$ = this.select(this.notificationBox$, this.notificationBoxTarget$, this.notificationBoxSettingsMode$, (notificationBox, target, mode) => dbxFirebaseNotificationUserSettingsTexts({ notificationBox: target ? notificationBox : undefined, mode, hasToggle: this.hasNotificationBoxContext }));

  /**
   * The hint shown above the settings. Uses the global hint while a targeted box's context is off.
   */
  readonly hint$ = this.select(this.texts$, this.notificationBoxTarget$, this.notificationBoxId$, (texts, target, notificationBoxId) => (target != null && notificationBoxId == null ? (texts.globalHint ?? texts.hint) : texts.hint));

  // MARK: Document
  /**
   * The loaded NotificationUser.
   */
  readonly notificationUser$: Observable<Maybe<NotificationUser>> = this.select(this.notificationUserDocumentStore.dataLoadingState$, (state) => state.value);

  /**
   * The user's saved config for the NotificationBox being edited (their `bc` entry), if they have one.
   */
  readonly savedBoxConfig$ = this.select(this.notificationUser$, this.notificationBoxId$, (notificationUser, notificationBoxId) => (notificationBoxId == null ? undefined : notificationUser?.bc.find((x) => x.nb === notificationBoxId)));

  /**
   * The user's saved config for the targeted NotificationBox (their `bc` entry), if they have one. Unlike {@link savedBoxConfig$}, it is set
   * in either mode and whether or not the box context is on.
   */
  readonly savedTargetBoxConfig$ = this.select(this.notificationUser$, this.notificationBoxTarget$, (notificationUser, target) => (target == null ? undefined : notificationUser?.bc.find((x) => x.nb === target.notificationBoxId)));

  /**
   * Whether a NotificationBox is targeted but does not send to the user: they have no `bc` entry for it, or they removed themselves (`rm`).
   */
  readonly isNotBoxRecipient$ = this.select(this.notificationBoxTarget$, this.savedTargetBoxConfig$, (target, entry) => target != null && (entry == null || entry.rm === true));

  /**
   * The targeted NotificationBox's on/off switch. Undefined when no box is targeted, or the user is not one of its recipients.
   */
  readonly boxSwitch$: Observable<Maybe<DbxFirebaseNotificationUserSettingsBoxSwitch>> = this.select(
    this.savedTargetBoxConfig$,
    this.select((state) => state.boxEnabledEdit),
    (entry, boxEnabledEdit) => {
      let result: Maybe<DbxFirebaseNotificationUserSettingsBoxSwitch>;

      if (entry != null && !entry.rm) {
        const locked = Boolean(entry.x) || entry.f === NotificationBoxRecipientFlag.DISABLED;
        const savedEnabled = isNotificationBoxEnabledInConfig(entry);
        const enabled = !locked && (boxEnabledEdit ?? savedEnabled);
        result = { enabled, modified: !locked && boxEnabledEdit != null && boxEnabledEdit !== savedEnabled, locked };
      }

      return result;
    }
  );

  /**
   * The pending change of the targeted NotificationBox's switch, or undefined when it has none.
   */
  readonly notificationBoxEnabledChange$: Observable<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxEnabledChange>> = this.select(this.notificationBoxTarget$, this.boxSwitch$, (target, boxSwitch) =>
    target != null && boxSwitch?.modified ? { notificationBoxId: target.notificationBoxId, enabled: boxSwitch.enabled } : undefined
  );

  readonly pageState$ = this.select(this.notificationUserDocumentStore.hasRef$, this.notificationUserDocumentStore.dataLoadingState$, this.notificationBoxId$, (hasRef, state, notificationBoxId) => {
    let pageState: DbxFirebaseNotificationUserSettingsPageState;

    if (state.value) {
      const entry = notificationBoxId == null ? undefined : state.value.bc.find((x) => x.nb === notificationBoxId);
      pageState = notificationBoxId != null && (entry == null || entry.rm) ? 'notRecipient' : 'ready';
    } else if (!hasRef || isLoadingStateLoading(state)) {
      pageState = 'loading';
    } else {
      // creating a NotificationUser would not make the user a recipient of the box
      pageState = notificationBoxId == null ? 'missing' : 'notRecipient';
    }

    return pageState;
  });

  /**
   * The saved global config.
   */
  readonly savedGc$ = this.select(this.notificationUser$, (notificationUser) => notificationUser?.gc);

  /**
   * The saved template configs the cells edit: the box config's while a box is being edited, otherwise `gc`'s.
   */
  readonly savedTemplateConfigs$: Observable<Maybe<NotificationBoxRecipientTemplateConfigRecord>> = this.select(this.savedGc$, this.savedBoxConfig$, this.notificationBoxId$, (gc, boxConfig, notificationBoxId) => (notificationBoxId == null ? gc?.c : boxConfig?.c));

  // MARK: List
  /**
   * The list rows. Only changes with the config and the targeted box, so cell changes and switching the box context never recreate the rows.
   *
   * With a targeted box, only the template types of the box's model are shown.
   */
  readonly items$ = this.select(this.config$, this.notificationBoxTarget$, (config, target) => {
    const { groups, templateTypes, hiddenTemplateTypes, fallbackGroupBy, defaultGroup } = config;
    const recordService = this.notificationTemplateService.appNotificationTemplateTypeInfoRecordService;
    const typeInfos = target ? recordService.getTemplateTypesInfoForNotificationModel(target.modelKey) : recordService.getAllKnownTemplateTypeInfo();
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
  readonly cellStates$ = this.select(
    this.select({ items: this.items$, deliveryMethods: this.columns$, gc: this.savedGc$, edits: this.select((state) => state.cellEdits), disabledDeliveryMethods: this.disabledDeliveryMethods$, notificationBoxId: this.notificationBoxId$, savedBoxConfig: this.savedBoxConfig$, texts: this.texts$ }),
    ({ notificationBoxId, savedBoxConfig, texts, ...input }) => dbxFirebaseNotificationSettingsCellStates({ ...input, boxConfig: notificationBoxId == null ? undefined : (savedBoxConfig ?? { c: {} }), overrideDescription: texts.overrideDescription })
  );

  /**
   * Whether every cell and switch is disabled, which is until the NotificationUser is loaded.
   */
  readonly disabled$ = this.select(this.pageState$, (pageState) => pageState !== 'ready');

  // MARK: Changes
  /**
   * The `updateNotificationUser()` params for the pending changes, or undefined when nothing changed.
   *
   * Cell changes go to `gc`, or to the box's `bc` entry while the cells edit a box. Delivery method switch changes always go to `gc`. A box
   * switch change goes to the box's `bc` entry `f`. Any `bc` change is sent with `resync`.
   */
  readonly updateParams$ = this.select(
    this.select({
      gc: this.savedGc$,
      notificationBoxId: this.notificationBoxId$,
      boxConfig: this.savedBoxConfig$,
      edits: this.select((state) => state.cellEdits),
      disabledDeliveryMethods: this.nextDisabledDeliveryMethods$,
      notificationBoxEnabledChange: this.notificationBoxEnabledChange$
    }),
    (input) => dbxFirebaseNotificationUserSettingsUpdateParams(input)
  );

  readonly isModified$ = this.select(this.updateParams$, (params) => params != null);

  /**
   * Whether there are pending cell changes. The cells are keyed by type only, so they can't carry over to another box or to `gc`.
   */
  readonly hasCellEdits$ = this.select(this.updateParams$, this.notificationBoxId$, (params, notificationBoxId) => (notificationBoxId == null ? params?.gc?.configs != null : params?.bc != null));

  /**
   * Whether saving the pending changes opts into texts for the first time, which records the user's consent.
   */
  readonly enablesText$ = this.select(this.savedGc$, this.updateParams$, (gc, params) => !hasNotificationDeliveryMethodOptIn(gc, NotificationDeliveryMethod.TEXT) && params?.gc != null && hasNotificationDeliveryMethodOptIn(applyGcUpdateParams(gc, params.gc), NotificationDeliveryMethod.TEXT));

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
   * Turns all of the targeted NotificationBox's notifications on or off for the user. Setting it back to its saved state is not a change, and
   * a locked switch (see {@link DbxFirebaseNotificationUserSettingsBoxSwitch.locked}) ignores it.
   */
  readonly setNotificationBoxEnabled = this.updater((state, enabled: boolean) => ({ ...state, boxEnabledEdit: enabled }));

  /**
   * Discards all pending changes.
   */
  readonly reset = this.updater((state) => ({ ...state, cellEdits: {}, methodEdits: {}, boxEnabledEdit: undefined }));

  /**
   * Drops the pending edits the saved config already has. Cell edits are compared with the template configs the cells edit, and switch
   * edits with `gc`.
   */
  private readonly _dropSavedEdits = this.updater((state, saved: { readonly gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>; readonly c: Maybe<NotificationBoxRecipientTemplateConfigRecord> }) => ({
    ...state,
    cellEdits: unsavedCellEdits(state.cellEdits, saved.c),
    methodEdits: unsavedMethodEdits(state.methodEdits, saved.gc)
  }));

  /**
   * Drops the pending box switch edit once the targeted box's saved config has it.
   */
  private readonly _dropSavedBoxEnabledEdit = this.updater((state, entry: Maybe<NotificationUserNotificationBoxRecipientConfig>) => ({
    ...state,
    boxEnabledEdit: entry != null && state.boxEnabledEdit === isNotificationBoxEnabledInConfig(entry) ? undefined : state.boxEnabledEdit
  }));

  private readonly _clearBoxEnabledEdit = this.updater((state) => ({ ...state, boxEnabledEdit: undefined }));

  /**
   * Clears the pending box switch edit whenever the targeted NotificationBox changes.
   */
  private readonly _clearBoxEnabledEditOnTargetChange = this.effect((notificationBoxId$: Observable<Maybe<NotificationBoxId>>) =>
    notificationBoxId$.pipe(
      distinctUntilChanged(),
      skip(1),
      tap(() => this._clearBoxEnabledEdit())
    )
  );

  private readonly _clearCellEdits = this.updater((state) => ({ ...state, cellEdits: {} }));

  /**
   * Clears the cell edits whenever the NotificationBox being edited changes: a new config, a new context box, or the box context switching
   * on or off. Cell edits are keyed by type only, so they can't carry over. Switch edits apply to `gc` either way and are kept.
   */
  private readonly _clearCellEditsOnTargetChange = this.effect((notificationBoxId$: Observable<Maybe<NotificationBoxId>>) =>
    notificationBoxId$.pipe(
      distinctUntilChanged(),
      skip(1),
      tap(() => this._clearCellEdits())
    )
  );

  /**
   * Reports pending cell changes to the ancestor {@link DbxFirebaseNotificationBoxContext}, so its toggle is locked while there are any.
   */
  private readonly _reportLocked = this.effect((locked$: Observable<boolean>) =>
    locked$.pipe(
      distinctUntilChanged(),
      tap((locked) => this._notificationBoxContext?.setLocked(locked)),
      finalize(() => this._notificationBoxContext?.setLocked(false))
    )
  );
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
 * Returns the cell edits whose value differs from the saved template configs.
 *
 * @param cellEdits - The pending cell edits.
 * @param c - The saved template configs the cells edit.
 * @returns The cell edits not yet saved.
 */
function unsavedCellEdits(cellEdits: DbxFirebaseNotificationSettingsCellEdits, c: Maybe<NotificationBoxRecipientTemplateConfigRecord>): DbxFirebaseNotificationSettingsCellEdits {
  const result: DbxFirebaseNotificationSettingsCellEdits = {};

  Object.entries(cellEdits).forEach(([type, typeEdits]) => {
    (Object.entries(typeEdits) as [NotificationDeliveryMethod, Maybe<boolean>][]).forEach(([method, value]) => {
      if ((value ?? null) !== (readNotificationDeliveryMethodFlag(c?.[type], method) ?? null)) {
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

/**
 * Returns whether the user's saved box config has them getting the box's notifications, meaning they have not opted out. A box that
 * excluded or disabled the user is handled separately, as a locked switch.
 *
 * @param entry - The user's saved box config.
 * @returns True unless the user opted out of the box.
 */
function isNotificationBoxEnabledInConfig(entry: Pick<NotificationUserNotificationBoxRecipientConfig, 'f'>): boolean {
  return entry.f !== NotificationBoxRecipientFlag.OPT_OUT;
}

function applyGcUpdateParams(gc: Maybe<NotificationUserDefaultNotificationBoxRecipientConfig>, params: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams): NotificationUserDefaultNotificationBoxRecipientConfig {
  return updateNotificationUserDefaultNotificationBoxRecipientConfig({ ...gc, c: gc?.c ?? {} }, params);
}
