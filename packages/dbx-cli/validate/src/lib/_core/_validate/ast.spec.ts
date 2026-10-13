import { describe, expect, it } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import { buildDereekbImportIndex, buildInMemoryProject, isDereekbModuleSpecifier, readArrayElementTypeNode, readCalleeName, readImportedIdentifier, readTypeReferenceName, type ImportedIdentifier } from './ast.js';

/**
 * Reads the resolved callee name of every call in a one-file project, in source order.
 *
 * @param text - The file's source text.
 * @returns The {@link readCalleeName} result of each call.
 */
function calleeNamesOf(text: string): (string | undefined)[] {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const imports = buildDereekbImportIndex(apiSources);
  return apiSources[0].getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => readCalleeName(call, imports));
}

/**
 * Reads the initializer of the top-level `probe` variable of a one-file project with {@link readImportedIdentifier}.
 *
 * @param text - The file's source text.
 * @returns The {@link readImportedIdentifier} result.
 */
function importedIdentifierOf(text: string): ImportedIdentifier | undefined {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  return readImportedIdentifier(apiSources[0].getVariableDeclarationOrThrow('probe').getInitializer());
}

describe('readCalleeName()', () => {
  it('reads an @dereekb/* import alias as the exported name', () => {
    expect(calleeNamesOf(`import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';\nsfHandler();`)).toEqual(['storageFileProcessingNotificationTaskHandler']);
  });

  it('reads an @dereekb/* namespace member as the member name', () => {
    expect(calleeNamesOf(`import * as serverModel from '@dereekb/firebase-server/model';\nserverModel.storageFileProcessingNotificationTaskHandler();`)).toEqual(['storageFileProcessingNotificationTaskHandler']);
  });

  it('reads a plain identifier as written, imported or not', () => {
    expect(calleeNamesOf(`import { notificationTaskService } from '@dereekb/firebase-server/model';\nnotificationTaskService();\nlocalHelper();`)).toEqual(['notificationTaskService', 'localHelper']);
  });

  it('does not resolve an alias or namespace of a module outside @dereekb/*', () => {
    expect(calleeNamesOf(`import { storageFileProcessingNotificationTaskHandler as sfHandler } from 'some-lib';\nimport * as lib from 'some-lib';\nsfHandler();\nlib.storageFileProcessingNotificationTaskHandler();`)).toEqual(['sfHandler', undefined]);
  });

  it('does not resolve an alias shadowed by a parameter', () => {
    expect(calleeNamesOf(`import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';\nfunction f(sfHandler: () => void) { return sfHandler(); }`)).toEqual(['sfHandler']);
  });

  it('does not resolve a namespace shadowed by a const', () => {
    expect(calleeNamesOf(`import * as serverModel from '@dereekb/firebase-server/model';\nfunction f() { const serverModel = { storageFileProcessingNotificationTaskHandler: () => 0 }; return serverModel.storageFileProcessingNotificationTaskHandler(); }`)).toEqual([undefined]);
  });

  it('reads a property-access callee and a call-result callee as undefined', () => {
    expect(calleeNamesOf(`const obj = { fn: () => () => 0 };\nobj.fn();\nobj.fn()();`)).toEqual([undefined, undefined, undefined]);
  });

  it('still resolves a callee whose alias the file also declares as a type parameter', () => {
    expect(calleeNamesOf(`import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';\nfunction f<sfHandler>(x: sfHandler) { return x; }\nsfHandler();`)).toEqual(['storageFileProcessingNotificationTaskHandler']);
  });
});

describe('readCalleeName() — local const references', () => {
  const SF = 'storageFileProcessingNotificationTaskHandler';
  const FS = 'formSpaceSubmissionNotificationTaskHandler';
  const IMPORTS = `import { ${SF}, ${FS} } from '@dereekb/firebase-server/model';\n`;

  it.each<[string, string, (string | undefined)[]]>([
    ['follows a const holding an exact name', `function f() { const create = ${SF}; return create({}); }`, [SF]],
    ['follows a const holding an @dereekb/* alias', `import { ${SF} as sfHandler } from '@dereekb/firebase-server/model';\nfunction f() { const create = sfHandler; return create({}); }`, [SF]],
    ['follows a const holding an @dereekb/* namespace member', `import * as m from '@dereekb/firebase-server/model';\nfunction f() { const create = m.${SF}; return create({}); }`, [SF]],
    ['follows a const with an as-cast initializer', `function f() { const create = ${SF} as typeof ${SF}; return create({}); }`, [SF]],
    ['follows a module-level const', `const create = ${SF};\nfunction f() { return create({}); }`, [SF]],
    ['follows a const chain', `function f() { const a = ${SF}; const b = a; return b({}); }`, [SF]],
    ['follows a const in a switch case', `function f(x: number) { switch (x) { case 1: const create = ${SF}; return create({}); } return undefined; }`, [SF]],
    ['reads each function its own const', `function f() { const create = ${SF}; return create({}); }\nfunction g() { const create = ${FS}; return create({}); }`, [SF, FS]],
    ['ignores a same-named parameter in another function', `function f() { const create = ${SF}; return create({}); }\nfunction g(create: () => void) { return create(); }`, [SF, 'create']],
    ['ignores a same-named arrow parameter in another function', `function f() { const create = ${SF}; return create({}); }\nfunction g(list: (() => void)[]) { return list.map((create) => create()); }`, [SF, undefined, 'create']],
    ['does not follow a let or var', `function f() { let create = ${SF}; return create({}); }\nfunction g() { var make = ${SF}; return make({}); }`, ['create', 'make']],
    ['does not follow a const shadowed by a parameter', `const create = ${FS};\nfunction f(context: unknown, create = ${SF}) { return create({}); }`, ['create']],
    ['does not follow two consts in scope', `const create = ${FS};\nfunction f() { const create = ${SF}; return create({}); }`, ['create']],
    ['does not follow a const out of its function', `function f() { const create = ${SF}; return 0; }\nfunction g() { return create({}); }`, ['create']],
    ['does not follow a const out of its block', `function f(x: boolean) { if (x) { const create = ${SF}; } return create({}); }`, ['create']],
    ['does not follow past a function-expression name', `const create = ${SF};\nconst g = function create() { return create({}); };`, ['create']],
    ['does not follow a for-loop const', `function f() { for (const create = ${SF}; ; ) { return create({}); } }`, ['create']],
    ['does not follow a destructured const', `import * as m from '@dereekb/firebase-server/model';\nfunction f() { const { ${SF}: create } = m; return create({}); }`, ['create']],
    ['does not follow a call initializer', `function f(pick: <T>(x: T) => T) { const create = pick(${SF}); return create({}); }`, ['pick', 'create']],
    ['reads a const holding a non-namespace member as undefined', `const obj = { fn: () => 0 };\nconst create = obj.fn;\ncreate();`, [undefined]],
    ['stops at the hop limit', `const a = b;\nconst b = a;\na();`, ['a']],
    ['counts a function-expression name in the alias guard', `import { ${SF} as sfHandler } from '@dereekb/firebase-server/model';\nconst g = function sfHandler() { return sfHandler(); };`, ['sfHandler']]
  ])('%s', (_label, text, expected) => {
    expect(calleeNamesOf(`${IMPORTS}${text}`)).toEqual(expected);
  });
});

/**
 * Reads the resolved type-annotation name of every variable declaration in a one-file project, in source order.
 *
 * @param text - The file's source text.
 * @returns The {@link readTypeReferenceName} result of each declaration's annotation.
 */
function annotationNamesOf(text: string): (string | undefined)[] {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const imports = buildDereekbImportIndex(apiSources);
  return apiSources[0].getDescendantsOfKind(SyntaxKind.VariableDeclaration).map((decl) => readTypeReferenceName(decl.getTypeNode(), imports));
}

/**
 * Reads the resolved array element type name of every variable declaration in a one-file project, in source order.
 *
 * @param text - The file's source text.
 * @returns The {@link readTypeReferenceName} result of each annotation's {@link readArrayElementTypeNode}.
 */
function arrayElementNamesOf(text: string): (string | undefined)[] {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const imports = buildDereekbImportIndex(apiSources);
  return apiSources[0].getDescendantsOfKind(SyntaxKind.VariableDeclaration).map((decl) => readTypeReferenceName(readArrayElementTypeNode(decl.getTypeNode()), imports));
}

describe('readTypeReferenceName()', () => {
  const TASK_TYPE_ALIAS_IMPORT = `import { type NotificationTaskType as TaskType } from '@dereekb/firebase';\n`;
  const TASK_TYPE_NAMESPACE_IMPORT = `import type * as firebaseModel from '@dereekb/firebase';\n`;

  it('reads an @dereekb/* type import alias as the exported name', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}const a: TaskType = 'a';`)).toEqual(['NotificationTaskType']);
    expect(annotationNamesOf(`import type { NotificationTaskType as TaskType } from '@dereekb/firebase';\nconst a: TaskType = 'a';`)).toEqual(['NotificationTaskType']);
  });

  it('reads an @dereekb/* namespace member type as the member name', () => {
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}const a: firebaseModel.NotificationTaskType = 'a';`)).toEqual(['NotificationTaskType']);
    expect(annotationNamesOf(`import * as firebaseModel from '@dereekb/firebase';\nconst a: firebaseModel.NotificationTaskType = 'a';`)).toEqual(['NotificationTaskType']);
  });

  it('reads the name of a generic reference, aliased or namespaced', () => {
    expect(
      annotationNamesOf(`import { type NotificationTaskServiceTaskHandlerConfig as HandlerConfig } from '@dereekb/firebase-server/model';\nimport type * as serverModel from '@dereekb/firebase-server/model';\nconst a: HandlerConfig<D, S> = {};\nconst b: serverModel.NotificationTaskServiceTaskHandlerConfig<D> = {};`)
    ).toEqual(['NotificationTaskServiceTaskHandlerConfig', 'NotificationTaskServiceTaskHandlerConfig']);
  });

  it('reads a plain identifier as written, imported or not', () => {
    expect(annotationNamesOf(`import { type NotificationTaskType } from '@dereekb/firebase';\nconst a: NotificationTaskType = 'a';\nconst b: LocalType = 'b';`)).toEqual(['NotificationTaskType', 'LocalType']);
  });

  it('does not resolve an alias or namespace of a module outside @dereekb/*', () => {
    expect(annotationNamesOf(`import { type NotificationTaskType as TaskType } from 'some-lib';\nimport type * as lib from 'some-lib';\nconst a: TaskType = 'a';\nconst b: lib.NotificationTaskType = 'b';`)).toEqual(['TaskType', undefined]);
  });

  it('does not resolve an alias the file also declares as a type parameter, type alias or interface', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f<TaskType>(x: TaskType) { return x; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType']);
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f() { type TaskType = number; const x: TaskType = 1; return x; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'TaskType']);
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f() { interface TaskType { x: 1 } const y: TaskType = { x: 1 }; return y; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'TaskType']);
  });

  it('does not resolve an alias the file also declares as a value', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f(TaskType: string) { return TaskType; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType']);
  });

  it('does not resolve a namespace the file also declares as a type parameter or enum', () => {
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}function f<firebaseModel>(x: firebaseModel) { return x; }\nconst a: firebaseModel.NotificationTaskType = 'a';`)).toEqual([undefined]);
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}function f() { enum firebaseModel { A } return firebaseModel.A; }\nconst a: firebaseModel.NotificationTaskType = 'a';`)).toEqual([undefined]);
  });

  it('reads a deeper qualified name and a non-reference type as undefined', () => {
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}const a: firebaseModel.inner.NotificationTaskType = 'a';\nconst b: NotificationTaskType | undefined = 'b';\nconst c: NotificationTaskType[] = [];\nconst d: typeof x = x;\nconst e: 'e' = 'e';\nconst f = 'f';`)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    ]);
  });
});

describe('readArrayElementTypeNode()', () => {
  it('reads the element type of T[], readonly T[], Array<T> and ReadonlyArray<T>', () => {
    expect(
      arrayElementNamesOf(
        `import { type NotificationTaskType as TaskType } from '@dereekb/firebase';\nimport type * as firebaseModel from '@dereekb/firebase';\nconst a: TaskType[] = [];\nconst b: readonly TaskType[] = [];\nconst c: Array<TaskType> = [];\nconst d: ReadonlyArray<firebaseModel.NotificationTaskType> = [];\nconst e: firebaseModel.NotificationTaskType[] = [];`
      )
    ).toEqual(['NotificationTaskType', 'NotificationTaskType', 'NotificationTaskType', 'NotificationTaskType', 'NotificationTaskType']);
  });

  it('reads other types as undefined', () => {
    expect(arrayElementNamesOf(`const a: TaskType = 'a';\nconst b: Set<TaskType> = new Set();\nconst c: [TaskType] = ['c'];\nconst d: keyof TaskType[] = 0;\nconst e: (TaskType | undefined)[] = [];\nconst f = [];`)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });
});

describe('readImportedIdentifier()', () => {
  const IMPORT = "import { ALL_NOTIFICATION_TASK_TYPES } from 'demo-firebase';\n";

  it('reads an unaliased named import with its module', () => {
    expect(importedIdentifierOf(`${IMPORT}const probe = ALL_NOTIFICATION_TASK_TYPES;`)).toEqual({ name: 'ALL_NOTIFICATION_TASK_TYPES', moduleSpecifier: 'demo-firebase' });
  });

  it('strips an `as` cast', () => {
    expect(importedIdentifierOf(`${IMPORT}const probe = ALL_NOTIFICATION_TASK_TYPES as string[];`)).toEqual({ name: 'ALL_NOTIFICATION_TASK_TYPES', moduleSpecifier: 'demo-firebase' });
  });

  it('reads an @dereekb/* import too; the caller filters it', () => {
    expect(importedIdentifierOf(`import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';\nconst probe = ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES;`)).toEqual({ name: 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', moduleSpecifier: '@dereekb/firebase' });
  });

  it.each([
    ['a name the file does not import', `const probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['an aliased import', `import { ALL_NOTIFICATION_TASK_TYPES as TASK_TYPES } from 'demo-firebase';\nconst probe = TASK_TYPES;`],
    ['a type-only import', `import { type ALL_NOTIFICATION_TASK_TYPES } from 'demo-firebase';\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['a namespace member', `import * as demoFirebase from 'demo-firebase';\nconst probe = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;`],
    ['an import shadowed by a parameter', `${IMPORT}function f(ALL_NOTIFICATION_TASK_TYPES: string[]) { return ALL_NOTIFICATION_TASK_TYPES; }\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['an import shadowed by a local const', `${IMPORT}function f() { const ALL_NOTIFICATION_TASK_TYPES: string[] = []; return ALL_NOTIFICATION_TASK_TYPES; }\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['a value that is not an identifier', `${IMPORT}const probe = [...ALL_NOTIFICATION_TASK_TYPES];`]
  ])('reads %s as undefined', (_label, text) => {
    expect(importedIdentifierOf(text)).toBeUndefined();
  });

  it('tells @dereekb/* modules apart', () => {
    expect([isDereekbModuleSpecifier('@dereekb/firebase'), isDereekbModuleSpecifier('demo-firebase'), isDereekbModuleSpecifier('./notification.task')]).toEqual([true, false, false]);
  });
});
