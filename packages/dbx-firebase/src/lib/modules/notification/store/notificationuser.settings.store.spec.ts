import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AppNotificationTemplateTypeInfoRecordService, appNotificationTemplateTypeInfoRecordService, firestoreModelIdentity, NotificationDeliveryMethod, type NotificationTemplateTypeInfo, type NotificationUser } from '@dereekb/firebase';
import { beginLoading, type LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { DbxFirebaseNotificationUserSettingsStore, type DbxFirebaseNotificationUserSettingsStoreConfig } from './notificationuser.settings.store';
import { NotificationUserDocumentStore } from './notificationuser.document.store';

const { EMAIL, TEXT } = NotificationDeliveryMethod;
const UID = 'uid1';

const profileIdentity = firestoreModelIdentity('profile', 'p');
const EXAMPLE_TYPE_INFO: NotificationTemplateTypeInfo = { type: 'E', name: 'Example', description: 'Example notification.', notificationModelIdentity: profileIdentity, group: { key: 'profile', name: 'Your Profile' } };
const TYPE_INFO_RECORD = { E: EXAMPLE_TYPE_INFO };

type TestGc = Partial<NotificationUser['gc']>;

function makeNotificationUser(gc: TestGc): NotificationUser & { id: string; key: string } {
  return { id: UID, key: `nu/${UID}`, uid: UID, b: [], x: [], gc, dc: {}, bc: [] } as unknown as NotificationUser & { id: string; key: string };
}

describe('DbxFirebaseNotificationUserSettingsStore', () => {
  let store: DbxFirebaseNotificationUserSettingsStore;
  let dataLoadingState$: BehaviorSubject<LoadingState<NotificationUser>>;
  let authUser$: BehaviorSubject<{ uid: string; phoneNumber: string | null }>;

  function setNotificationUser(gc: TestGc) {
    const notificationUser = makeNotificationUser(gc);
    dataLoadingState$.next(successResult(notificationUser));
    return notificationUser;
  }

  beforeEach(() => {
    dataLoadingState$ = new BehaviorSubject<LoadingState<NotificationUser>>(beginLoading());
    authUser$ = new BehaviorSubject<{ uid: string; phoneNumber: string | null }>({ uid: UID, phoneNumber: '+15555550199' });

    TestBed.configureTestingModule({
      providers: [
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

    store = TestBed.inject(DbxFirebaseNotificationUserSettingsStore);
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

    expect(await firstValueFrom(store.updateParams$)).toEqual({ configs: [{ type: 'E', st: true }], dm: [EMAIL] });
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

    expect(await firstValueFrom(store.updateParams$)).toEqual({ configs: [{ type: 'E', st: true }] });
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
      expect(await firstValueFrom(store.updateParams$)).toEqual({ dm: null });

      setNotificationUser({ dm: [TEXT] });
      expect(await firstValueFrom(store.updateParams$)).toBeUndefined();
    });

    it('should still turn other methods off', async () => {
      setNotificationUser({});

      store.setMethodEnabled({ method: EMAIL, enabled: false });
      expect(await firstValueFrom(store.updateParams$)).toEqual({ dm: [EMAIL] });
    });
  });
});
