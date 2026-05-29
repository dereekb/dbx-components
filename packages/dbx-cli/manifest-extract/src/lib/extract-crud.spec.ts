import { describe, expect, it } from 'vitest';
import { extractCrudEntries } from './extract-crud';

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

const QUERY_SOURCE = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';

/**
 * Params for searching guestbooks.
 */
export interface QueryGuestbooksParams {
  /**
   * Optional name filter.
   */
  readonly name?: string;
}

/**
 * Result returned from a guestbook query.
 */
export interface QueryGuestbooksResult {
  /**
   * Matched guestbook keys.
   */
  readonly keys: readonly string[];
}

export type GuestbookFunctionTypeMap = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    query: {
      _: [QueryGuestbooksParams, QueryGuestbooksResult];
      byName: [QueryGuestbooksParams, QueryGuestbooksResult];
    };
  };
  guestbookEntry: {
    query: QueryGuestbooksParams;
  };
};

export const guestbookModelCrudFunctionsConfig = {
  guestbook: ['query:_,byName'],
  guestbookEntry: ['query']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory({}, guestbookModelCrudFunctionsConfig);
`;

const ADMIN_ONLY_SOURCE = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';

/**
 * Update a guestbook.
 * @dbxModelApiParams
 */
export interface UpdateGuestbookParams {
  /**
   * New name visible to readers.
   */
  readonly name?: string;
  /**
   * Force-publish without moderation review.
   * @dbxModelApiAdminOnly
   */
  readonly forcePublish?: boolean;
}

/**
 * Create a guestbook. Intentionally missing the marker tag for tests.
 */
export interface CreateGuestbookParams {
  /**
   * Display name.
   */
  readonly name: string;
}

export type GuestbookFunctionTypeMap = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: UpdateGuestbookParams;
  };
};

export const guestbookModelCrudFunctionsConfig = {
  guestbook: ['create', 'update']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory({}, guestbookModelCrudFunctionsConfig);
`;

const DOCS_SOURCE = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';

/**
 * Params for downloading an archive.
 */
export interface DownloadProfileArchiveParams {
  /**
   * Profile id to archive.
   */
  readonly profileId: string;
}

/**
 * Result returned to the caller after kicking off an archive download.
 */
export interface DownloadProfileArchiveResult {
  /**
   * Signed URL the caller can fetch the archive from.
   */
  readonly downloadUrl: string;
  readonly expiresAt: number;
}

export type ProfileFunctionTypeMap = {};

export type ProfileModelCrudFunctionsConfig = {
  profile: {
    read: {
      downloadArchive: [DownloadProfileArchiveParams, DownloadProfileArchiveResult];
    };
  };
};

export abstract class ProfileFunctions {}

export const profileModelCrudFunctionsConfig = {
  profile: ['read:downloadArchive']
};

export const profileFunctionMap = callModelFirebaseFunctionMapFactory({}, profileModelCrudFunctionsConfig);
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

  it('walks query CRUD entries (nested specifiers, bare params, and JSDocs)', () => {
    const extraction = extractCrudEntries({ name: 'guestbook.api.ts', text: QUERY_SOURCE });
    expect(extraction.groupName).toBe('Guestbook');
    expect(extraction.modelKeys).toEqual(['guestbook', 'guestbookEntry']);

    const queryDefault = extraction.entries.find((e) => e.model === 'guestbook' && e.verb === 'query' && e.specifier === '_');
    expect(queryDefault?.paramsTypeName).toBe('QueryGuestbooksParams');
    expect(queryDefault?.resultTypeName).toBe('QueryGuestbooksResult');
    expect(queryDefault?.paramsTypeDescription).toBe('Params for searching guestbooks.');
    expect(queryDefault?.paramsFields).toEqual([{ name: 'name', typeText: 'string', description: 'Optional name filter.' }]);
    expect(queryDefault?.resultTypeDescription).toBe('Result returned from a guestbook query.');
    expect(queryDefault?.resultFields).toEqual([{ name: 'keys', typeText: 'readonly string[]', description: 'Matched guestbook keys.' }]);

    const queryByName = extraction.entries.find((e) => e.model === 'guestbook' && e.verb === 'query' && e.specifier === 'byName');
    expect(queryByName?.paramsTypeName).toBe('QueryGuestbooksParams');
    expect(queryByName?.resultTypeName).toBe('QueryGuestbooksResult');

    const entryQuery = extraction.entries.find((e) => e.model === 'guestbookEntry' && e.verb === 'query');
    expect(entryQuery?.specifier).toBeUndefined();
    expect(entryQuery?.paramsTypeName).toBe('QueryGuestbooksParams');
    expect(entryQuery?.resultTypeName).toBeUndefined();
  });

  it('surfaces @dbxModelApiParams marker and @dbxModelApiAdminOnly field access level', () => {
    const extraction = extractCrudEntries({ name: 'guestbook.api.ts', text: ADMIN_ONLY_SOURCE });

    const update = extraction.entries.find((e) => e.verb === 'update');
    expect(update?.paramsTypeName).toBe('UpdateGuestbookParams');
    expect(update?.paramsHasApiParamsTag).toBe(true);
    expect(update?.paramsFields).toEqual([
      { name: 'name', typeText: 'string', description: 'New name visible to readers.' },
      { name: 'forcePublish', typeText: 'boolean', description: 'Force-publish without moderation review.', accessLevel: 'adminOnly' }
    ]);

    const create = extraction.entries.find((e) => e.verb === 'create');
    expect(create?.paramsTypeName).toBe('CreateGuestbookParams');
    expect(create?.paramsHasApiParamsTag).toBe(false);
    expect(create?.paramsFields).toEqual([{ name: 'name', typeText: 'string', description: 'Display name.' }]);
  });

  it('reads JSDoc on params and result interfaces and surfaces functionsClassName', () => {
    const extraction = extractCrudEntries({ name: 'profile.api.ts', text: DOCS_SOURCE });
    expect(extraction.functionsClassName).toBe('ProfileFunctions');

    const downloadArchive = extraction.entries.find((e) => e.verb === 'read' && e.specifier === 'downloadArchive');
    expect(downloadArchive).toBeDefined();
    expect(downloadArchive?.paramsTypeDescription).toBe('Params for downloading an archive.');
    expect(downloadArchive?.paramsFields).toEqual([{ name: 'profileId', typeText: 'string', description: 'Profile id to archive.' }]);

    expect(downloadArchive?.resultTypeDescription).toBe('Result returned to the caller after kicking off an archive download.');
    expect(downloadArchive?.resultFields).toEqual([
      { name: 'downloadUrl', typeText: 'string', description: 'Signed URL the caller can fetch the archive from.' },
      { name: 'expiresAt', typeText: 'number' }
    ]);
  });
});
