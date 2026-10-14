import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filter, firstValueFrom } from 'rxjs';
import { MODEL_NOT_AVAILABLE_ERROR_CODE, NotificationFunctions, type NotificationTaskBotOptOutsResult, type NotificationTaskBotOwnerOptOutGroup, notificationTaskBotKeyForModel, type UpdateNotificationTaskBotOptOutParams } from '@dereekb/firebase';
import { isLoadingStateFinishedLoading } from '@dereekb/rxjs';
import { DbxFirebaseNotificationTaskBotSettingsStore } from './notificationtaskbot.settings.store';

const MODEL_KEY = 'pr/uid1';
const BOT_KEY = notificationTaskBotKeyForModel(MODEL_KEY);
const OPTED_OUT_AT = new Date('2026-01-01T00:00:00.000Z');

const PING_GROUP: NotificationTaskBotOwnerOptOutGroup = { key: 'ping_reminders', name: 'Ping Reminders', description: 'Pings.' };
const EMAIL_GROUP: NotificationTaskBotOwnerOptOutGroup = { key: 'email_reminders', name: 'Email Reminders', optOutAt: OPTED_OUT_AT };

describe('DbxFirebaseNotificationTaskBotSettingsStore', () => {
  let store: DbxFirebaseNotificationTaskBotSettingsStore;
  let readOptOuts: ReturnType<typeof vi.fn>;
  let updateOptOut: ReturnType<typeof vi.fn>;

  function configureStore(): DbxFirebaseNotificationTaskBotSettingsStore {
    TestBed.configureTestingModule({
      providers: [
        DbxFirebaseNotificationTaskBotSettingsStore,
        {
          provide: NotificationFunctions,
          useValue: {
            notificationTaskBot: {
              readNotificationTaskBot: { optOuts: readOptOuts },
              updateNotificationTaskBot: { optOut: updateOptOut }
            }
          }
        }
      ]
    });

    return TestBed.inject(DbxFirebaseNotificationTaskBotSettingsStore);
  }

  function loadedPageState() {
    return firstValueFrom(store.pageState$.pipe(filter((x) => x !== 'loading')));
  }

  async function loadGroups(groups: NotificationTaskBotOwnerOptOutGroup[] = [PING_GROUP, EMAIL_GROUP]) {
    readOptOuts.mockResolvedValue({ groups } as NotificationTaskBotOptOutsResult);
    store.setModelKey(MODEL_KEY);
    return loadedPageState();
  }

  beforeEach(() => {
    readOptOuts = vi.fn();
    updateOptOut = vi.fn();
    store = configureStore();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('page state', () => {
    it('should be loading until a model key is set', async () => {
      expect(await firstValueFrom(store.pageState$)).toBe('loading');
      expect(await firstValueFrom(store.disabled$)).toBe(true);
    });

    it('should load the groups for the bot of the model', async () => {
      expect(await loadGroups()).toBe('ready');
      expect(readOptOuts).toHaveBeenCalledWith({ key: BOT_KEY });
      expect(await firstValueFrom(store.disabled$)).toBe(false);
    });

    it('should be missing when the model has no bot', async () => {
      readOptOuts.mockRejectedValue({ code: MODEL_NOT_AVAILABLE_ERROR_CODE, message: 'Not available.' });
      store.setModelKey(MODEL_KEY);
      expect(await loadedPageState()).toBe('missing');
    });

    it('should be error for any other failure', async () => {
      readOptOuts.mockRejectedValue({ code: 'INTERNAL', message: 'Failed.' });
      store.setModelKey(MODEL_KEY);
      expect(await loadedPageState()).toBe('error');
    });
  });

  describe('pending edits', () => {
    beforeEach(async () => {
      await loadGroups();
    });

    it('should report the saved state with no edits', async () => {
      const rows = await firstValueFrom(store.rows$);

      expect(rows.map((x) => [x.group.key, x.optedOut, x.modified])).toEqual([
        [PING_GROUP.key, false, false],
        [EMAIL_GROUP.key, true, false]
      ]);
      expect(await firstValueFrom(store.isModified$)).toBe(false);
      expect(await firstValueFrom(store.updateParams$)).toBeUndefined();
    });

    it('should merge the edits into the rows and build the update params', async () => {
      store.setOptedOut({ key: PING_GROUP.key, optedOut: true });
      store.setOptedOut({ key: EMAIL_GROUP.key, optedOut: false });

      const rows = await firstValueFrom(store.rows$);
      expect(rows.every((x) => x.modified)).toBe(true);
      expect(await firstValueFrom(store.isModified$)).toBe(true);
      expect(await firstValueFrom(store.updateParams$)).toEqual({ key: BOT_KEY, optOut: [PING_GROUP.key], optIn: [EMAIL_GROUP.key] });
    });

    it('should drop an edit that matches the saved state', async () => {
      store.setOptedOut({ key: PING_GROUP.key, optedOut: true });
      store.setOptedOut({ key: PING_GROUP.key, optedOut: false });

      expect(await firstValueFrom(store.isModified$)).toBe(false);
      expect(await firstValueFrom(store.updateParams$)).toBeUndefined();
    });

    it('should drop every edit on reset', async () => {
      store.setOptedOut({ key: PING_GROUP.key, optedOut: true });
      store.reset();

      expect(await firstValueFrom(store.isModified$)).toBe(false);
    });
  });

  describe('update()', () => {
    beforeEach(async () => {
      await loadGroups();
    });

    it('should replace the groups with the result and drop the saved edits', async () => {
      const savedPingGroup = { ...PING_GROUP, optOutAt: OPTED_OUT_AT };
      updateOptOut.mockResolvedValue({ groups: [savedPingGroup, EMAIL_GROUP] } as NotificationTaskBotOptOutsResult);

      store.setOptedOut({ key: PING_GROUP.key, optedOut: true });
      const params = (await firstValueFrom(store.updateParams$)) as UpdateNotificationTaskBotOptOutParams;
      const result = await firstValueFrom(store.update(params).pipe(filter((x) => isLoadingStateFinishedLoading(x))));

      expect(updateOptOut).toHaveBeenCalledWith({ key: BOT_KEY, optOut: [PING_GROUP.key] });
      expect(result.value?.groups[0].optOutAt).toEqual(OPTED_OUT_AT);
      expect(await firstValueFrom(store.isModified$)).toBe(false);
      expect((await firstValueFrom(store.rows$))[0].optedOut).toBe(true);
    });

    it('should keep the edits when the update fails', async () => {
      updateOptOut.mockRejectedValue({ code: 'INTERNAL', message: 'Failed.' });

      store.setOptedOut({ key: PING_GROUP.key, optedOut: true });
      const params = (await firstValueFrom(store.updateParams$)) as UpdateNotificationTaskBotOptOutParams;
      const result = await firstValueFrom(store.update(params).pipe(filter((x) => isLoadingStateFinishedLoading(x))));

      expect(result.error).toBeDefined();
      expect(await firstValueFrom(store.isModified$)).toBe(true);
    });
  });
});
