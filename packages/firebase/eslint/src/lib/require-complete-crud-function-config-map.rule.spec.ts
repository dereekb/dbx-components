import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE } from './require-complete-crud-function-config-map.rule';

const RULE_ID = 'dereekb-firebase/require-complete-crud-function-config-map';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-complete-crud-function-config-map': FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

const NOTIFICATION_TYPE_DEF = `
type UpdateNotificationUserParams = object;
type ResyncNotificationUserParams = object;
type ResyncNotificationUserResult = object;
type UpdateNotificationSummaryParams = object;
type UpdateNotificationBoxParams = object;
type UpdateNotificationBoxRecipientParams = object;
type SendNotificationParams = object;
type SendNotificationResult = object;
type NotificationTypes = object;

export type NotificationBoxModelCrudFunctionsConfig = {
  readonly notificationUser: {
    update: {
      _: UpdateNotificationUserParams;
      resync: [ResyncNotificationUserParams, ResyncNotificationUserResult];
    };
  };
  readonly notificationSummary: {
    update: {
      _: UpdateNotificationSummaryParams;
    };
  };
  readonly notificationBox: {
    update: {
      _: UpdateNotificationBoxParams;
      recipient: UpdateNotificationBoxRecipientParams;
    };
  };
  readonly notification: {
    update: {
      send: [SendNotificationParams, SendNotificationResult];
    };
  };
  readonly notificationWeek: null;
  readonly notificationLoggedEventDay: null;
  readonly notificationLoggedEventDayPage: null;
};

type ModelFirebaseCrudFunctionConfigMap<C, T> = unknown;
`;

const STORAGEFILE_TYPE_DEF = `
type ModelFirebaseCrudFunctionConfigMap<C, T> = unknown;
type StorageFileTypes = object;
type CreateStorageFileParams = object;
type InitializeStorageFileFromUploadParams = object;
type InitializeAllStorageFilesFromUploadsParams = object;
type InitializeAllStorageFilesFromUploadsResult = object;
type UpdateStorageFileParams = object;
type ProcessStorageFileParams = object;
type ProcessStorageFileResult = object;
type SyncStorageFileWithGroupsParams = object;
type SyncStorageFileWithGroupsResult = object;
type DownloadStorageFileParams = object;
type DownloadStorageFileResult = object;
type DownloadMultipleStorageFilesParams = object;
type DownloadMultipleStorageFilesResult = object;
type DeleteStorageFileParams = object;
type UpdateStorageFileGroupParams = object;
type RegenerateStorageFileGroupContentParams = object;
type RegenerateStorageFileGroupContentResult = object;

export type StorageFileModelCrudFunctionsConfig = {
  readonly storageFile: {
    create: {
      _: CreateStorageFileParams;
      fromUpload: InitializeStorageFileFromUploadParams;
      allFromUpload: [InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult];
    };
    update: {
      _: UpdateStorageFileParams;
      process: [ProcessStorageFileParams, ProcessStorageFileResult];
      syncWithGroups: [SyncStorageFileWithGroupsParams, SyncStorageFileWithGroupsResult];
    };
    read: {
      download: [DownloadStorageFileParams, DownloadStorageFileResult];
      downloadMultiple: [DownloadMultipleStorageFilesParams, DownloadMultipleStorageFilesResult];
    };
    delete: {
      _: DeleteStorageFileParams;
    };
  };
  readonly storageFileGroup: {
    update: {
      _: UpdateStorageFileGroupParams;
      regenerateContent: [RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult];
    };
  };
};
`;

const EXAMPLE_BARE_VERB_TYPE_DEF = `
type ModelFirebaseCrudFunctionConfigMap<C, T> = unknown;
type ExampleTypes = object;
type QueryExampleParams = object;
type OnCallQueryModelResult<T> = object;

export type ExampleModelCrudFunctionsConfig = {
  example: {
    read: {
      user: [object, boolean];
    };
    create: {
      _: object;
      user: object;
    };
    update: {
      _: object;
      sendUserInvite: object;
      admin: object;
    };
    delete: object;
    query: {
      _: [QueryExampleParams, OnCallQueryModelResult<object>];
      byName: [QueryExampleParams, OnCallQueryModelResult<object>];
    };
  };
};
`;

describe('require-complete-crud-function-config-map rule', () => {
  it('does not flag a fully-correct NotificationBox config', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toEqual([]);
  });

  it('does not flag a fully-correct StorageFile config (multi-verb, delete:_ variant)', () => {
    const errors = lintCode(`${STORAGEFILE_TYPE_DEF}
export const STORAGE_FILE_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<StorageFileModelCrudFunctionsConfig, StorageFileTypes> = {
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process,syncWithGroups', 'delete:_', 'read:download,downloadMultiple'],
  storageFileGroup: ['update:_,regenerateContent']
};
`);
    expect(errors).toEqual([]);
  });

  it('does not flag a config that uses a bare verb (delete: object → "delete")', () => {
    const errors = lintCode(`${EXAMPLE_BARE_VERB_TYPE_DEF}
export const exampleModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ExampleModelCrudFunctionsConfig, ExampleTypes> = {
  example: ['read:user', 'create:_,user', 'update:_,sendUserInvite,admin', 'delete', 'query:_,byName']
};
`);
    expect(errors).toEqual([]);
  });

  it('ignores variables that are not typed as ModelFirebaseCrudFunctionConfigMap', () => {
    const errors = lintCode(`
export const SOMETHING_ELSE: Record<string, string[]> = {
  notificationUser: ['update:_,resync']
};
`);
    expect(errors).toEqual([]);
  });

  it('flags a missing enabled model key', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync'],
  notificationSummary: ['update:_'],
  notification: ['update:send']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingModelKey');
    expect(errors[0].message).toContain('notificationBox');
  });

  it('flags a disabled (null) model key that appears in the config', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send'],
  notificationWeek: ['update:_']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('disabledModelKeyPresent');
    expect(errors[0].message).toContain('notificationWeek');
  });

  it('flags an unknown model key not declared in the type', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send'],
  notificationGhost: ['update:_']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('unknownModelKey');
    expect(errors[0].message).toContain('notificationGhost');
  });

  it('flags a missing specifier inside an existing verb entry', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingSpecifier');
    expect(errors[0].message).toContain('resync');
  });

  it('flags an unknown specifier in an existing verb entry', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync,extra'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('unknownSpecifier');
    expect(errors[0].message).toContain('extra');
  });

  it('flags a missing verb for an enabled model', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: [],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingVerb');
    expect(errors[0].message).toContain('update');
  });

  it('flags an unknown verb in a config entry', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync', 'read:foo'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('unknownVerbInEntry');
  });

  it('flags a duplicate specifier within the same entry', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,_,resync'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('duplicateSpecifierInEntry');
  });

  it('sees through "as any" on an entry string (validates the literal under the cast)', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync' as any],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toEqual([]);
  });

  it('flags content under an "as any" cast when the structural check fails', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_' as any],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingSpecifier');
  });

  it('sees through "as const" on an entry string', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync' as const],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    expect(errors).toEqual([]);
  });

  it('flags a verb that should be bare but includes specifiers', () => {
    const errors = lintCode(`${EXAMPLE_BARE_VERB_TYPE_DEF}
export const exampleModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ExampleModelCrudFunctionsConfig, ExampleTypes> = {
  example: ['read:user', 'create:_,user', 'update:_,sendUserInvite,admin', 'delete:_', 'query:_,byName']
};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('unexpectedSpecifiersForVerb');
  });

  it('flags a verb whose value should be a string array', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: 'update:_,resync',
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('expectedStringArray');
  });

  it('flags a non-object-literal initializer', () => {
    const errors = lintCode(`${NOTIFICATION_TYPE_DEF}
declare const SHARED: any;
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = SHARED;
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('expectedObjectLiteral');
  });

  it('flags a missing companion type alias', () => {
    const errors = lintCode(`
type ModelFirebaseCrudFunctionConfigMap<C, T> = unknown;
type NotificationTypes = object;
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync']
};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('configTypeNotFound');
  });

  it('flags a companion type that is not an inline type literal', () => {
    const errors = lintCode(`
type ModelFirebaseCrudFunctionConfigMap<C, T> = unknown;
type NotificationTypes = object;
export type NotificationBoxModelCrudFunctionsConfig = Record<string, unknown>;
export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {};
`);
    const ids = errors.map((e) => e.messageId);
    expect(ids).toContain('expectedTypeLiteral');
  });
});
