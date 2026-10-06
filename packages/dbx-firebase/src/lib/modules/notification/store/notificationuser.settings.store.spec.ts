import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { AppNotificationTemplateTypeInfoRecordService, appNotificationTemplateTypeInfoRecordService, firestoreModelIdentity, NotificationDeliveryMethod, type NotificationTemplateTypeInfo, type NotificationUser, type UpdateNotificationUserParams } from '@dereekb/firebase';
import { beginLoading, type LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { DbxFirebaseNotificationUserSettingsStore } from './notificationuser.settings.store';
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
  let updateResult$: Subject<LoadingState<void>>;
  let updateNotificationUser: ReturnType<typeof vi.fn>;
  let authUser$: BehaviorSubject<{ uid: string; phoneNumber: string | null }>;

  function setNotificationUser(gc: TestGc) {
    const notificationUser = makeNotificationUser(gc);
    dataLoadingState$.next(successResult(notificationUser));
    TestBed.tick();
    return notificationUser;
  }

  beforeEach(() => {
    dataLoadingState$ = new BehaviorSubject<LoadingState<NotificationUser>>(beginLoading());
    updateResult$ = new Subject();
    updateNotificationUser = vi.fn((_: Partial<UpdateNotificationUserParams>) => updateResult$);
    authUser$ = new BehaviorSubject<{ uid: string; phoneNumber: string | null }>({ uid: UID, phoneNumber: '+15555550199' });

    TestBed.configureTestingModule({
      providers: [
        DbxFirebaseNotificationUserSettingsStore,
        {
          provide: NotificationUserDocumentStore,
          useValue: {
            hasRef$: of(true),
            dataLoadingState$,
            currentId$: of(UID),
            updateNotificationUser,
            createNotificationUser: vi.fn(() => of(successResult({ modelKeys: [`nu/${UID}`] })))
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

  it('should be loading until the NotificationUser loads', () => {
    TestBed.tick();
    expect(store.pageStateSignal()).toBe('loading');

    setNotificationUser({});
    expect(store.pageStateSignal()).toBe('ready');
  });

  it('should be missing when the NotificationUser does not exist', () => {
    dataLoadingState$.next({ loading: false, error: { code: 'NOT_FOUND', message: 'Does not exist.' } });
    TestBed.tick();

    expect(store.pageStateSignal()).toBe('missing');
  });

  it('should clear the edit when a cell is set back to its saved value', () => {
    setNotificationUser({ c: { E: { st: true } } });

    store.setCellValue('E', TEXT, false);
    expect(store.isModifiedSignal()).toBe(true);
    expect(store.cellStatesSignal()['E'][TEXT]?.modified).toBe(true);

    store.setCellValue('E', TEXT, true);
    expect(store.isModifiedSignal()).toBe(false);
    expect(store.updateParamsSignal()).toBeUndefined();
  });

  it('should save the pending changes as one gc update', () => {
    setNotificationUser({});

    store.setCellValue('E', TEXT, true);
    store.setMethodEnabled(EMAIL, false);
    store.save().subscribe();

    expect(updateNotificationUser).toHaveBeenCalledTimes(1);
    expect(updateNotificationUser).toHaveBeenCalledWith({ gc: { configs: [{ type: 'E', st: true }], dm: [EMAIL] } });
    expect(store.savingSignal()).toBe(true);
  });

  it('should hold the saved values until the next snapshot', () => {
    setNotificationUser({});

    store.setCellValue('E', TEXT, true);
    store.save().subscribe();

    updateResult$.next(successResult(undefined));
    updateResult$.complete();

    // pending edits are cleared, but the saved value still shows before the snapshot arrives
    expect(store.isModifiedSignal()).toBe(false);
    expect(store.savingSignal()).toBe(false);
    expect(store.cellStatesSignal()['E'][TEXT]?.value).toBe(true);

    // the next snapshot replaces the optimistic value
    setNotificationUser({ c: { E: { st: false } } });
    expect(store.cellStatesSignal()['E'][TEXT]?.value).toBe(false);
  });

  it('should keep the pending changes when the save fails', () => {
    setNotificationUser({});

    store.setCellValue('E', TEXT, true);
    store.save().subscribe();

    updateResult$.next({ loading: false, error: { code: 'FAILED', message: 'Failed.' } });
    updateResult$.complete();

    expect(store.isModifiedSignal()).toBe(true);
    expect(store.savingSignal()).toBe(false);
  });

  it('should discard the pending changes on reset', () => {
    setNotificationUser({ dm: [TEXT], t: '+15555550100' });

    store.setCellValue('E', EMAIL, false);
    store.setMethodEnabled(TEXT, true);
    expect(store.disabledDeliveryMethodsSignal()).toEqual([]);

    store.reset();
    expect(store.isModifiedSignal()).toBe(false);
    expect(store.disabledDeliveryMethodsSignal()).toEqual([TEXT]);
  });

  it('should report when saving enables texts', () => {
    setNotificationUser({ t: '+15555550100' });
    expect(store.enablesTextSignal()).toBe(false);

    store.setCellValue('E', TEXT, true);
    expect(store.enablesTextSignal()).toBe(true);

    store.setMethodEnabled(TEXT, false);
    expect(store.enablesTextSignal()).toBe(false);
  });

  it('should only send texts to a saved phone number and suggest the account phone number', () => {
    setNotificationUser({});
    expect(store.textPhoneNumberSignal()).toBeUndefined();
    expect(store.canEnableTextSignal()).toBe(false);
    expect(store.authPhoneNumberSignal()).toBe('+15555550199');

    setNotificationUser({ t: '+15555550100' });
    expect(store.textPhoneNumberSignal()).toBe('+15555550100');
    expect(store.canEnableTextSignal()).toBe(true);
  });

  describe('without a phone number for texts', () => {
    it('should show texts as off and disable the text column', () => {
      setNotificationUser({});

      expect(store.disabledDeliveryMethodsSignal()).toEqual([TEXT]);
      expect(store.deliveryMethodSwitchesSignal()).toEqual([{ method: TEXT, enabled: false, modified: false, awaitingPhoneNumber: false }]);
      expect(store.cellStatesSignal()['E'][TEXT]?.disabled).toBe(true);
      expect(store.cellStatesSignal()['E'][EMAIL]?.disabled).toBe(false);
    });

    it('should open the phone number form instead of turning texts on', () => {
      setNotificationUser({ dm: [TEXT] });

      store.setMethodEnabled(TEXT, true);
      expect(store.isModifiedSignal()).toBe(false);
      expect(store.textPhoneNumberFormOpenSignal()).toBe(true);
      expect(store.deliveryMethodSwitchesSignal()[0]).toEqual({ method: TEXT, enabled: true, modified: false, awaitingPhoneNumber: true });

      store.setMethodEnabled(TEXT, false);
      expect(store.textPhoneNumberFormOpenSignal()).toBe(false);
    });

    it('should turn texts on when the phone number is saved', () => {
      setNotificationUser({ dm: [TEXT, EMAIL] });
      store.setMethodEnabled(TEXT, true);

      store.saveTextPhoneNumber('+15555550100').subscribe();
      expect(updateNotificationUser).toHaveBeenCalledWith({ gc: { t: '+15555550100', dm: [EMAIL] } });

      updateResult$.next(successResult(undefined));
      updateResult$.complete();

      // the saved number shows before the next snapshot arrives
      expect(store.canEnableTextSignal()).toBe(true);
      expect(store.deliveryMethodSwitchesSignal()[0].enabled).toBe(true);
    });

    it('should not save turning texts on once the phone number is gone', () => {
      setNotificationUser({ dm: [TEXT], t: '+15555550100' });

      store.setMethodEnabled(TEXT, true);
      expect(store.updateParamsSignal()).toEqual({ dm: null });

      setNotificationUser({ dm: [TEXT] });
      expect(store.updateParamsSignal()).toBeUndefined();
    });

    it('should still turn other methods off', () => {
      setNotificationUser({});

      store.setMethodEnabled(EMAIL, false);
      expect(store.updateParamsSignal()).toEqual({ dm: [EMAIL] });
    });
  });

  it('should create the NotificationUser for the current id', () => {
    const documentStore = TestBed.inject(NotificationUserDocumentStore);
    store.createNotificationUser().subscribe();
    expect(documentStore.createNotificationUser).toHaveBeenCalledWith({ uid: UID });
  });
});
