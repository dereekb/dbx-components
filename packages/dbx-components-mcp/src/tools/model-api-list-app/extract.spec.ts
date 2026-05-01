import { describe, expect, it } from 'vitest';
import { extractCrudEntries } from '../model-api-shared/index.js';

const PROFILE_SOURCE = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';

export type ProfileFunctionTypeMap = {
  profileSetUsername: [SetProfileUsernameParams, void];
};

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    read: {
      downloadArchive: [DownloadProfileArchiveParams, DownloadProfileArchiveResult];
    };
    update: {
      _: UpdateProfileParams;
      username: SetProfileUsernameParams;
      onboard: [FinishOnboardingProfileParams, boolean];
    };
    delete: UpdateProfileParams;
  };
  profilePrivate: null;
};

export const profileModelCrudFunctionsConfig = {
  profile: ['read:downloadArchive', 'update:_,username,onboard', 'delete']
};

export const profileFunctionMap = callModelFirebaseFunctionMapFactory({}, profileModelCrudFunctionsConfig);
`;

const GUESTBOOK_SOURCE = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';

export type GuestbookFunctionTypeMap = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: {
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
    };
  };
  guestbookEntry: {
    update: {
      insert: InsertGuestbookEntryParams;
      like: LikeGuestbookEntryParams;
    };
    delete: GuestbookEntryParams;
  };
};

export const guestbookModelCrudFunctionsConfig = {
  guestbook: ['create', 'update:subscribeToNotifications'],
  guestbookEntry: ['update:insert,like', 'delete']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory({}, guestbookModelCrudFunctionsConfig);
`;

describe('extractCrudEntries', () => {
  it('walks profile CRUD config and FunctionTypeMap', () => {
    const extraction = extractCrudEntries({ name: 'profile.api.ts', text: PROFILE_SOURCE });
    expect(extraction.groupName).toBe('Profile');
    expect(extraction.modelKeys).toEqual(['profile', 'profilePrivate']);

    const find = (verb: string, specifier: string | undefined) => extraction.entries.find((e) => e.verb === verb && e.specifier === specifier);

    const downloadArchive = find('read', 'downloadArchive');
    expect(downloadArchive).toBeDefined();
    expect(downloadArchive?.model).toBe('profile');
    expect(downloadArchive?.paramsTypeName).toBe('DownloadProfileArchiveParams');
    expect(downloadArchive?.resultTypeName).toBe('DownloadProfileArchiveResult');

    const updateUsername = find('update', 'username');
    expect(updateUsername?.paramsTypeName).toBe('SetProfileUsernameParams');
    expect(updateUsername?.resultTypeName).toBeUndefined();

    const updateOnboard = find('update', 'onboard');
    expect(updateOnboard?.paramsTypeName).toBe('FinishOnboardingProfileParams');
    expect(updateOnboard?.resultTypeName).toBe('boolean');

    const updateDefault = find('update', '_');
    expect(updateDefault?.paramsTypeName).toBe('UpdateProfileParams');

    const deleteEntry = find('delete', undefined);
    expect(deleteEntry?.model).toBe('profile');
    expect(deleteEntry?.paramsTypeName).toBe('UpdateProfileParams');

    const standalone = extraction.entries.find((e) => e.verb === 'standalone');
    expect(standalone?.model).toBe('profileSetUsername');
    expect(standalone?.paramsTypeName).toBe('SetProfileUsernameParams');
    expect(standalone?.resultTypeName).toBe('void');

    expect(extraction.entries.find((e) => e.model === 'profilePrivate')).toBeUndefined();
  });

  it('walks guestbook CRUD config across two models', () => {
    const extraction = extractCrudEntries({ name: 'guestbook.api.ts', text: GUESTBOOK_SOURCE });
    expect(extraction.groupName).toBe('Guestbook');
    expect(extraction.modelKeys).toEqual(['guestbook', 'guestbookEntry']);

    const guestbookCreate = extraction.entries.find((e) => e.model === 'guestbook' && e.verb === 'create');
    expect(guestbookCreate?.specifier).toBeUndefined();
    expect(guestbookCreate?.paramsTypeName).toBe('CreateGuestbookParams');

    const guestbookUpdate = extraction.entries.find((e) => e.model === 'guestbook' && e.verb === 'update');
    expect(guestbookUpdate?.specifier).toBe('subscribeToNotifications');

    const entryDelete = extraction.entries.find((e) => e.model === 'guestbookEntry' && e.verb === 'delete');
    expect(entryDelete?.specifier).toBeUndefined();
    expect(entryDelete?.paramsTypeName).toBe('GuestbookEntryParams');

    const entryUpdates = extraction.entries.filter((e) => e.model === 'guestbookEntry' && e.verb === 'update');
    expect(entryUpdates.map((e) => e.specifier).sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual(['insert', 'like']);
  });
});
