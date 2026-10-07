import { type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import {
  AppNotificationTemplateTypeInfoRecordService,
  appNotificationTemplateTypeInfoRecordService,
  firestoreModelIdentity,
  notificationBoxIdForModel,
  NotificationBoxRecipientFlag,
  NotificationDeliveryMethod,
  type NotificationTemplateTypeInfo,
  type NotificationUser,
  type NotificationUserNotificationBoxRecipientConfig
} from '@dereekb/firebase';
import { beginLoading, type LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { type DbxFirebaseNotificationUserSettingsNotificationBoxConfig } from '../service/notification.settings';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { DbxFirebaseNotificationBoxContext } from './notification.box.context';
import { DbxFirebaseNotificationUserSettingsStore, type DbxFirebaseNotificationUserSettingsStoreConfig } from './notificationuser.settings.store';
import { NotificationUserDocumentStore } from './notificationuser.document.store';

const { EMAIL, TEXT } = NotificationDeliveryMethod;
const UID = 'uid1';

const profileIdentity = firestoreModelIdentity('profile', 'p');
const EXAMPLE_TYPE_INFO: NotificationTemplateTypeInfo = { type: 'E', name: 'Example', description: 'Example notification.', notificationModelIdentity: profileIdentity, group: { key: 'profile', name: 'Your Profile' } };
const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');
const GUESTBOOK_TYPE_INFO: NotificationTemplateTypeInfo = { type: 'GBE_C', name: 'Entry Created', description: 'A guestbook entry was created.', notificationModelIdentity: guestbookIdentity, group: { key: 'guestbook', name: 'Guestbooks' } };
const TYPE_INFO_RECORD = { E: EXAMPLE_TYPE_INFO, GBE_C: GUESTBOOK_TYPE_INFO };

const GUESTBOOK_KEY = 'gb/gb1';
const GUESTBOOK_BOX_ID = notificationBoxIdForModel(GUESTBOOK_KEY);
const OTHER_GUESTBOOK_KEY = 'gb/gb2';
const OTHER_GUESTBOOK_BOX_ID = notificationBoxIdForModel(OTHER_GUESTBOOK_KEY);

type TestGc = Partial<NotificationUser['gc']>;
type TestBc = Partial<NotificationUserNotificationBoxRecipientConfig>[];

function makeNotificationUser(gc: TestGc, bc: TestBc = []): NotificationUser & { id: string; key: string } {
  return { id: UID, key: `nu/${UID}`, uid: UID, b: [], x: [], gc, dc: {}, bc } as unknown as NotificationUser & { id: string; key: string };
}

function makeBoxConfig(nb: string, config: TestBc[number] = {}): TestBc[number] {
  return { nb, i: 0, c: {}, ...config };
}

describe('DbxFirebaseNotificationUserSettingsStore', () => {
  let store: DbxFirebaseNotificationUserSettingsStore;
  let dataLoadingState$: BehaviorSubject<LoadingState<NotificationUser>>;
  let authUser$: BehaviorSubject<{ uid: string; phoneNumber: string | null }>;

  function setNotificationUser(gc: TestGc, bc?: TestBc) {
    const notificationUser = makeNotificationUser(gc, bc);
    dataLoadingState$.next(successResult(notificationUser));
    return notificationUser;
  }

  function configureStore(extraProviders: Provider[] = []): DbxFirebaseNotificationUserSettingsStore {
    dataLoadingState$ = new BehaviorSubject<LoadingState<NotificationUser>>(beginLoading());
    authUser$ = new BehaviorSubject<{ uid: string; phoneNumber: string | null }>({ uid: UID, phoneNumber: '+15555550199' });

    TestBed.configureTestingModule({
      providers: [
        ...extraProviders,
        DbxFirebaseNotificationUserSettingsStore,
        {
          provide: NotificationUserDocumentStore,
          useValue: {
            hasRef$: of(true),
            dataLoadingState$
          }
        },
        {
          provide: DbxFirebaseNotificationTemplateService,
          useValue: { appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(TYPE_INFO_RECORD) }
        },
        { provide: AppNotificationTemplateTypeInfoRecordService, useValue: appNotificationTemplateTypeInfoRecordService(TYPE_INFO_RECORD) },
        { provide: DbxFirebaseAuthService, useValue: { currentAuthUser$: authUser$ } }
      ]
    });

    return TestBed.inject(DbxFirebaseNotificationUserSettingsStore);
  }

  beforeEach(() => {
    store = configureStore();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be loading until the NotificationUser loads', async () => {
    expect(await firstValueFrom(store.pageState$)).toBe('loading');

    setNotificationUser({});
    expect(await firstValueFrom(store.pageState$)).toBe('ready');
  });

  it('should be missing when the NotificationUser does not exist', async () => {
    dataLoadingState$.next({ loading: false, error: { code: 'NOT_FOUND', message: 'Does not exist.' } });
    expect(await firstValueFrom(store.pageState$)).toBe('missing');
  });

  it('should merge the config set from an observable over the app config', async () => {
    const config$ = new BehaviorSubject<DbxFirebaseNotificationUserSettingsStoreConfig>({ deliveryMethods: [EMAIL] });
    store.setConfig(config$);
    expect(await firstValueFrom(store.columns$)).toEqual([EMAIL]);

    config$.next({ deliveryMethods: [TEXT, EMAIL] });
    expect(await firstValueFrom(store.columns$)).toEqual([TEXT, EMAIL]);
  });

  it('should not count a cell set back to its saved value as a change', async () => {
    setNotificationUser({ c: { E: { st: true } } });

    store.setCellValue({ type: 'E', method: TEXT, value: false });
    expect(await firstValueFrom(store.isModified$)).toBe(true);
    expect((await firstValueFrom(store.cellStates$))['E'][TEXT]?.modified).toBe(true);

    store.setCellValue({ type: 'E', method: TEXT, value: true });
    expect(await firstValueFrom(store.isModified$)).toBe(false);
    expect(await firstValueFrom(store.updateParams$)).toBeUndefined();
    expect((await firstValueFrom(store.cellStates$))['E'][TEXT]?.modified).toBe(false);
  });

  it('should build one gc update from the pending changes', async () => {
    setNotificationUser({});

    store.setCellValue({ type: 'E', method: TEXT, value: true });
    store.setMethodEnabled({ method: EMAIL, enabled: false });

    expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { configs: [{ type: 'E', st: true }], dm: [EMAIL] } });
  });

  it('should drop the pending changes once a snapshot has them', async () => {
    setNotificationUser({});

    store.setCellValue({ type: 'E', method: TEXT, value: true });
    store.setMethodEnabled({ method: EMAIL, enabled: false });

    setNotificationUser({ c: { E: { st: true } }, dm: [EMAIL] });
    expect(await firstValueFrom(store.isModified$)).toBe(false);

    // the edits are gone, so a later snapshot shows as is
    setNotificationUser({ c: { E: { st: false } } });
    expect((await firstValueFrom(store.cellStates$))['E'][TEXT]?.value).toBe(false);
    expect(await firstValueFrom(store.isModified$)).toBe(false);
  });

  it('should keep the pending changes a snapshot does not have', async () => {
    setNotificationUser({});

    store.setCellValue({ type: 'E', method: TEXT, value: true });
    setNotificationUser({ c: { E: { se: false } } });

    expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { configs: [{ type: 'E', st: true }] } });
    expect((await firstValueFrom(store.cellStates$))['E'][TEXT]?.modified).toBe(true);
  });

  it('should discard the pending changes on reset', async () => {
    setNotificationUser({ dm: [TEXT], t: '+15555550100' });

    store.setCellValue({ type: 'E', method: EMAIL, value: false });
    store.setMethodEnabled({ method: TEXT, enabled: true });
    expect(await firstValueFrom(store.disabledDeliveryMethods$)).toEqual([]);

    store.reset();
    expect(await firstValueFrom(store.isModified$)).toBe(false);
    expect(await firstValueFrom(store.disabledDeliveryMethods$)).toEqual([TEXT]);
  });

  it('should report when saving enables texts', async () => {
    setNotificationUser({ t: '+15555550100' });
    expect(await firstValueFrom(store.enablesText$)).toBe(false);

    store.setCellValue({ type: 'E', method: TEXT, value: true });
    expect(await firstValueFrom(store.enablesText$)).toBe(true);

    store.setMethodEnabled({ method: TEXT, enabled: false });
    expect(await firstValueFrom(store.enablesText$)).toBe(false);
  });

  it('should only send texts to a saved phone number and suggest the account phone number', async () => {
    setNotificationUser({});
    expect(await firstValueFrom(store.textPhoneNumber$)).toBeUndefined();
    expect(await firstValueFrom(store.canEnableText$)).toBe(false);
    expect(await firstValueFrom(store.authPhoneNumber$)).toBe('+15555550199');

    setNotificationUser({ t: '+15555550100' });
    expect(await firstValueFrom(store.textPhoneNumber$)).toBe('+15555550100');
    expect(await firstValueFrom(store.canEnableText$)).toBe(true);
  });

  it('should only show the text consent date while texts are on', async () => {
    const tcat = new Date('2026-10-01T00:00:00Z');

    setNotificationUser({ t: '+15555550100', tcat, c: { E: { st: true } } });
    expect(await firstValueFrom(store.textConsentAt$)).toBe(tcat);

    setNotificationUser({ t: '+15555550100', tcat, c: { E: { st: true } }, dm: [TEXT] });
    expect(await firstValueFrom(store.textConsentAt$)).toBeUndefined();
  });

  describe('without a phone number for texts', () => {
    it('should show texts as off and disable the text column', async () => {
      setNotificationUser({});

      expect(await firstValueFrom(store.disabledDeliveryMethods$)).toEqual([TEXT]);
      expect(await firstValueFrom(store.deliveryMethodSwitches$)).toEqual([{ method: TEXT, enabled: false, modified: false, awaitingPhoneNumber: false }]);

      const cellStates = await firstValueFrom(store.cellStates$);
      expect(cellStates['E'][TEXT]?.disabled).toBe(true);
      expect(cellStates['E'][EMAIL]?.disabled).toBe(false);
    });

    it('should open the phone number form instead of turning texts on', async () => {
      setNotificationUser({ dm: [TEXT] });
      expect(await firstValueFrom(store.textPhoneNumberFormOpen$)).toBe(false);

      store.setMethodEnabled({ method: TEXT, enabled: true });
      expect(await firstValueFrom(store.isModified$)).toBe(false);
      expect(await firstValueFrom(store.textPhoneNumberFormOpen$)).toBe(true);
      expect((await firstValueFrom(store.deliveryMethodSwitches$))[0]).toEqual({ method: TEXT, enabled: true, modified: false, awaitingPhoneNumber: true });

      store.setMethodEnabled({ method: TEXT, enabled: false });
      expect(await firstValueFrom(store.isModified$)).toBe(false);
      expect(await firstValueFrom(store.textPhoneNumberFormOpen$)).toBe(false);
    });

    it('should always show the phone number form when texts have no switch', async () => {
      store.setConfig({ switchableDeliveryMethods: [] });
      setNotificationUser({});

      expect(await firstValueFrom(store.textPhoneNumberFormOpen$)).toBe(true);
    });

    it('should turn texts on once the phone number is saved', async () => {
      setNotificationUser({ dm: [TEXT, EMAIL] });
      store.setMethodEnabled({ method: TEXT, enabled: true });

      setNotificationUser({ t: '+15555550100', dm: [EMAIL] });
      expect(await firstValueFrom(store.canEnableText$)).toBe(true);
      expect(await firstValueFrom(store.isModified$)).toBe(false);

      const [textSwitch] = await firstValueFrom(store.deliveryMethodSwitches$);
      expect(textSwitch).toEqual({ method: TEXT, enabled: true, modified: false, awaitingPhoneNumber: false });

      // the text switch edit is dropped with the snapshot, so turning texts off elsewhere shows
      setNotificationUser({ t: '+15555550100', dm: [TEXT, EMAIL] });
      expect((await firstValueFrom(store.deliveryMethodSwitches$))[0].enabled).toBe(false);
    });

    it('should keep waiting for a phone number across snapshots', async () => {
      setNotificationUser({});
      store.setMethodEnabled({ method: TEXT, enabled: true });

      setNotificationUser({ c: { E: { se: false } } });
      expect(await firstValueFrom(store.awaitingTextPhoneNumber$)).toBe(true);
      expect(await firstValueFrom(store.textPhoneNumberFormOpen$)).toBe(true);
    });

    it('should not save turning texts on once the phone number is gone', async () => {
      setNotificationUser({ dm: [TEXT], t: '+15555550100' });

      store.setMethodEnabled({ method: TEXT, enabled: true });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { dm: null } });

      setNotificationUser({ dm: [TEXT] });
      expect(await firstValueFrom(store.updateParams$)).toBeUndefined();
    });

    it('should still turn other methods off', async () => {
      setNotificationUser({});

      store.setMethodEnabled({ method: EMAIL, enabled: false });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { dm: [EMAIL] } });
    });
  });
  describe('with a notificationBox', () => {
    const notificationBox: DbxFirebaseNotificationUserSettingsNotificationBoxConfig = { modelKey: GUESTBOOK_KEY, modelName: 'guestbook' };

    beforeEach(() => {
      store.setConfig({ notificationBox });
    });

    it('should be notRecipient when the user has no config for the box', async () => {
      setNotificationUser({}, [makeBoxConfig(OTHER_GUESTBOOK_BOX_ID)]);
      expect(await firstValueFrom(store.pageState$)).toBe('notRecipient');
    });

    it('should be notRecipient when the user removed themselves from the box', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID, { rm: true })]);
      expect(await firstValueFrom(store.pageState$)).toBe('notRecipient');
    });

    it('should be notRecipient when the NotificationUser does not exist', async () => {
      dataLoadingState$.next({ loading: false, error: { code: 'NOT_FOUND', message: 'Does not exist.' } });
      expect(await firstValueFrom(store.pageState$)).toBe('notRecipient');
    });

    it('should be ready for a recipient of the box', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID)]);
      expect(await firstValueFrom(store.pageState$)).toBe('ready');
      expect(await firstValueFrom(store.isBoxRecipientInactive$)).toBe(false);
    });

    it('should report an opted-out box config as inactive', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID, { f: NotificationBoxRecipientFlag.OPT_OUT })]);
      expect(await firstValueFrom(store.isBoxRecipientInactive$)).toBe(true);
    });

    it("should only show the box model's template types", async () => {
      const items = await firstValueFrom(store.items$);
      expect(items.map((x) => x.type)).toEqual(['GBE_C']);
    });

    it('should show the cells gc sets as overridden', async () => {
      setNotificationUser({ c: { GBE_C: { se: false } } }, [makeBoxConfig(GUESTBOOK_BOX_ID, { c: { GBE_C: { st: true } } })]);

      const row = (await firstValueFrom(store.cellStates$))['GBE_C'];
      expect(row[EMAIL]?.override?.value).toBe(false);
      expect(row[EMAIL]?.override?.description).toBe('Your setting for all guestbooks overrides this.');
      expect(row[TEXT]?.override).toBeUndefined();
      expect(row[TEXT]?.value).toBe(true);
    });

    it('should build a box update from the pending cell changes and send the switch changes as gc', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID)]);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ bc: [{ nb: GUESTBOOK_BOX_ID, configs: [{ type: 'GBE_C', st: true }] }], resync: true });

      store.setMethodEnabled({ method: EMAIL, enabled: false });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { dm: [EMAIL] }, bc: [{ nb: GUESTBOOK_BOX_ID, configs: [{ type: 'GBE_C', st: true }] }], resync: true });
    });

    it('should drop the pending cell changes once the box config has them', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID)]);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      expect(await firstValueFrom(store.isModified$)).toBe(true);

      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID, { c: { GBE_C: { st: true } } })]);
      expect(await firstValueFrom(store.select((state) => state.cellEdits))).toEqual({});
      expect(await firstValueFrom(store.isModified$)).toBe(false);
    });

    it('should clear the pending cell changes when the box changes', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID), makeBoxConfig(OTHER_GUESTBOOK_BOX_ID)]);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      store.setMethodEnabled({ method: EMAIL, enabled: false });

      store.setConfig({ notificationBox: { modelKey: OTHER_GUESTBOOK_KEY } });
      expect(await firstValueFrom(store.select((state) => state.cellEdits))).toEqual({});
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { dm: [EMAIL] } });
    });
  });

  describe('with a DbxFirebaseNotificationBoxContext', () => {
    let notificationBox$: BehaviorSubject<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>;
    let enabled$: BehaviorSubject<boolean>;
    let setLocked: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      TestBed.resetTestingModule();

      notificationBox$ = new BehaviorSubject<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>({ modelKey: GUESTBOOK_KEY, modelName: 'guestbook' });
      enabled$ = new BehaviorSubject<boolean>(true);
      setLocked = vi.fn();

      const context: DbxFirebaseNotificationBoxContext = { notificationBox$, enabled$, setLocked };
      store = configureStore([{ provide: DbxFirebaseNotificationBoxContext, useValue: context }]);
    });

    it('should use the context box over the config box', async () => {
      store.setConfig({ notificationBox: { modelKey: OTHER_GUESTBOOK_KEY } });
      expect((await firstValueFrom(store.activeNotificationBoxTarget$))?.notificationBoxId).toBe(GUESTBOOK_BOX_ID);
    });

    it('should mention the toggle in the override description', async () => {
      const texts = await firstValueFrom(store.texts$);
      expect(texts.overrideDescription).toBe('Your setting for all guestbooks overrides this. Switch to All guestbooks to change it.');
    });

    it('should edit gc for the box model rows while the context is off', async () => {
      setNotificationUser({ c: { GBE_C: { se: false } } }, [makeBoxConfig(GUESTBOOK_BOX_ID)]);
      enabled$.next(false);

      expect((await firstValueFrom(store.items$)).map((x) => x.type)).toEqual(['GBE_C']);

      const row = (await firstValueFrom(store.cellStates$))['GBE_C'];
      expect(row[EMAIL]?.override).toBeUndefined();
      expect(row[EMAIL]?.value).toBe(false);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { configs: [{ type: 'GBE_C', st: true }] } });
      expect(await firstValueFrom(store.hint$)).toContain('apply to all guestbooks');
    });

    it('should only be notRecipient while the context is on', async () => {
      setNotificationUser({}, []);
      expect(await firstValueFrom(store.pageState$)).toBe('notRecipient');

      enabled$.next(false);
      expect(await firstValueFrom(store.pageState$)).toBe('ready');
    });

    it('should clear the cell changes but keep the switch changes when the context switches', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID)]);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      store.setMethodEnabled({ method: EMAIL, enabled: false });

      enabled$.next(false);
      expect(await firstValueFrom(store.select((state) => state.cellEdits))).toEqual({});
      expect(await firstValueFrom(store.updateParams$)).toEqual({ gc: { dm: [EMAIL] } });
    });

    it('should lock the context while there are pending cell changes', async () => {
      setNotificationUser({}, [makeBoxConfig(GUESTBOOK_BOX_ID)]);

      store.setCellValue({ type: 'GBE_C', method: TEXT, value: true });
      await firstValueFrom(store.updateParams$);
      expect(setLocked).toHaveBeenLastCalledWith(true);

      store.reset();
      await firstValueFrom(store.updateParams$);
      expect(setLocked).toHaveBeenLastCalledWith(false);
    });
  });
});
