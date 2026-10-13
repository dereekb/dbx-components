import { describe, expect, it } from 'vitest';
import { Node, SyntaxKind, type Identifier } from 'ts-morph';
import { buildDereekbImportIndex, buildInMemoryProject, findSoleReturnExpression, isDereekbModuleSpecifier, readArrayElementTypeNode, readCalleeName, readImportedReference, readTypeReferenceName, resolveLocalVariable, unwrapOuterExpressions, type ImportedReference } from './ast.js';

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
    ['blocks an alias with a same-named function-expression name only inside the expression', `import { ${SF} as sfHandler } from '@dereekb/firebase-server/model';\nconst g = function sfHandler() { return sfHandler(); };\nsfHandler({});`, ['sfHandler', SF]]
  ])('%s', (_label, text, expected) => {
    expect(calleeNamesOf(`${IMPORTS}${text}`)).toEqual(expected);
  });
});

describe('readCalleeName() — alias and namespace scopes', () => {
  const SF = 'storageFileProcessingNotificationTaskHandler';
  const FS = 'formSpaceSubmissionNotificationTaskHandler';
  const ALIAS = `import { ${SF} as sfHandler } from '@dereekb/firebase-server/model';\n`;
  const NAMESPACE = `import * as serverModel from '@dereekb/firebase-server/model';\n`;

  it.each<[string, string, (string | undefined)[]]>([
    ['resolves an alias past a same-named parameter in another function', `${ALIAS}function f(sfHandler: () => void) { return sfHandler(); }\nfunction g() { return sfHandler({}); }`, ['sfHandler', SF]],
    ['resolves an alias past a same-named arrow parameter', `${ALIAS}function f(list: (() => void)[]) { list.map((sfHandler) => sfHandler()); return sfHandler({}); }`, [undefined, 'sfHandler', SF]],
    ['resolves an alias past same-named locals in another function', `${ALIAS}function f(x: { sfHandler: () => void }) { let a = 0; { let sfHandler = 1; } try { a = 1; } catch (sfHandler) { a = 2; } const { sfHandler: y } = x; return a; }\nfunction g() { return sfHandler({}); }`, [SF]],
    ['resolves an alias past a same-named function in another function', `${ALIAS}function f() { function sfHandler() { return 0; } return sfHandler(); }\nfunction g() { return sfHandler({}); }`, ['sfHandler', SF]],
    ['resolves an alias past a same-named method parameter', `${ALIAS}class A { m(sfHandler: () => void) { return sfHandler(); } n() { return sfHandler({}); } }`, ['sfHandler', SF]],
    ['resolves a namespace past a same-named const in another function', `${NAMESPACE}function f() { const serverModel = { ${SF}: () => 0 }; return serverModel.${SF}(); }\nfunction g() { return serverModel.${SF}({}); }`, [undefined, SF]],
    ['resolves a namespace past a same-named parameter in another function', `${NAMESPACE}function f(serverModel: { ${SF}: () => void }) { return serverModel.${SF}(); }\nfunction g() { return serverModel.${SF}({}); }`, [undefined, SF]],
    ['follows a const holding an alias past a same-named parameter in another function', `${ALIAS}function f(sfHandler: () => void) { return sfHandler(); }\nfunction g() { const create = sfHandler; return create({}); }`, ['sfHandler', SF]],
    ['follows a const holding a namespace member past a same-named parameter in another function', `${NAMESPACE}function f(serverModel: unknown) { return serverModel; }\nfunction g() { const create = serverModel.${SF}; return create({}); }`, [SF]],
    ['does not resolve an alias shadowed by a parameter of an enclosing function', `${ALIAS}function f(sfHandler: () => void) { return () => sfHandler(); }`, ['sfHandler']],
    ['does not resolve an alias where a same-named const is also in scope', `${ALIAS}function f() { const sfHandler = ${FS}; return sfHandler({}); }\nfunction g() { return sfHandler({}); }`, ['sfHandler', SF]],
    ['does not resolve a namespace where a same-named const is also in scope', `${NAMESPACE}function f(other: unknown) { const serverModel = other; return serverModel.${SF}({}); }\nfunction g() { return serverModel.${SF}({}); }`, [undefined, SF]],
    ['does not follow a const holding an alias shadowed where the const holds it', `${ALIAS}function g(sfHandler: () => void) { const create = sfHandler; return create({}); }`, ['sfHandler']],
    ['widens a block-scoped shadow to its whole function', `${ALIAS}function f(x: boolean) { if (x) { let sfHandler = 0; } return sfHandler({}); }`, ['sfHandler']],
    ['ignores same-named type parameters and interfaces for a callee', `${ALIAS}function f<sfHandler>() { type T = sfHandler; return sfHandler({}); }\nfunction g() { interface sfHandler { x: 1 } return sfHandler({}); }`, [SF, SF]],
    ['ignores member, property and type names', `${ALIAS}const o = { sfHandler() { return 0; } };\nclass A { sfHandler = 1; }\ninterface X { sfHandler: number }\nfunction h<sfHandler>() { return 0; }\nfunction g() { return sfHandler({}); }`, [SF]]
  ])('%s', (_label, text, expected) => {
    expect(calleeNamesOf(text)).toEqual(expected);
  });
});

describe('readCalleeName() — exact blocker scopes', () => {
  const SF = 'storageFileProcessingNotificationTaskHandler';
  const FS = 'formSpaceSubmissionNotificationTaskHandler';
  const ALIAS = `import { ${SF} as sfHandler } from '@dereekb/firebase-server/model';\n`;
  const NAMESPACE = `import * as serverModel from '@dereekb/firebase-server/model';\n`;

  it.each<[string, string, (string | undefined)[]]>([
    ['resolves an alias past same-named parameters of a function type and a constructor type', `${ALIAS}type T = (sfHandler: () => void) => void;\ntype C = new (sfHandler: number) => object;\nsfHandler({});`, [SF]],
    ['resolves an alias past a same-named parameter of a callback type in the same function', `${ALIAS}function f(cb: (sfHandler: number) => void) { cb(1); return sfHandler({}); }`, ['cb', SF]],
    ['resolves an alias past same-named parameters of method, call, construct and index signatures in the same function', `${ALIAS}function g() { interface I { m(sfHandler: number): void; (sfHandler: number): void; new (sfHandler: number): I; [sfHandler: string]: unknown } return sfHandler({}); }`, [SF]],
    ['resolves a namespace past a same-named parameter of a method signature', `${NAMESPACE}interface I { m(serverModel: unknown): void }\nfunction g() { return serverModel.${SF}({}); }`, [SF]],
    ['resolves an alias past a same-named class-expression name, but not inside it', `${ALIAS}const C = class sfHandler { m() { return sfHandler({}); } };\nsfHandler({});`, ['sfHandler', SF]],
    ['resolves a namespace past a same-named function-expression name in the same function, but not inside it', `${NAMESPACE}function g() { const h = function serverModel() { return serverModel.${SF}({}); }; return serverModel.${SF}({}); }`, [undefined, SF]],
    ['follows a const past a same-named function-expression name', `const create = ${SF};\nconst g = function create() { return 0; };\ncreate({});`, [SF]],
    [
      'resolves an alias past same-named declarations in namespace bodies, but not inside them',
      `${ALIAS}namespace N { function sfHandler() { return 0; } export const a = sfHandler(); }\nnamespace M { class sfHandler {} }\nnamespace O { enum sfHandler { A } }\nnamespace P { let sfHandler = 0; }\nnamespace Q { namespace sfHandler {} }\nsfHandler({});`,
      ['sfHandler', SF]
    ],
    ['resolves a namespace past a same-named const in a namespace body, but not inside it', `${NAMESPACE}namespace N { const serverModel = { ${SF}: () => 0 }; export const a = serverModel.${SF}(); }\nfunction g() { return serverModel.${SF}({}); }`, [undefined, SF]],
    ['resolves an alias in another body of a namespace whose same-named member is not exported', `${ALIAS}namespace N { function sfHandler() { return 0; } }\nnamespace N { export const a = sfHandler({}); }`, [SF]],
    ['widens an exported namespace member to the whole file', `${ALIAS}namespace N { export function sfHandler() { return 0; } }\nnamespace N { export const a = sfHandler({}); }\nsfHandler({});`, ['sfHandler', 'sfHandler']],
    ['widens an exported namespace member only to the next namespace body that holds it alone', `${ALIAS}namespace A { namespace B { export function sfHandler() { return 0; } } namespace B { export const a = sfHandler({}); } }\nsfHandler({});`, ['sfHandler', SF]],
    ['does not resolve an alias where a member of an ambient namespace of the name is in scope', `${ALIAS}declare namespace N { function sfHandler(): number; }\nnamespace N { export const a = sfHandler({}); }`, ['sfHandler']],
    ['does not resolve an alias where a namespace exported through a dotted name is in scope', `${ALIAS}namespace A { export namespace B.sfHandler { export const v = 1; } }\nnamespace A { export namespace B { export const a = sfHandler({}); } }`, ['sfHandler']],
    ['does not resolve an alias where an exported import-equals of the name is in scope', `${ALIAS}namespace M { export function f() { return 0; } }\nnamespace N { export import sfHandler = M.f; }\nnamespace N { export const a = sfHandler({}); }`, ['sfHandler']],
    ['does not resolve an alias where a const a namespace exports is in scope', `${ALIAS}namespace N { export const sfHandler = ${FS}; }\nnamespace N { export const a = sfHandler({}); }`, ['sfHandler']],
    ['does not follow a const a namespace exports', `namespace N { export const create = ${SF}; export const a = create({}); }`, ['create']]
  ])('%s', (_label, text, expected) => {
    expect(calleeNamesOf(text)).toEqual(expected);
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

  it('reads an alias as written only where a same-named type parameter, type alias or interface is in scope', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f<TaskType>(x: TaskType) { const y: TaskType = x; return y; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'NotificationTaskType']);
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f() { type TaskType = number; const x: TaskType = 1; return x; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'NotificationTaskType']);
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f() { interface TaskType { x: 1 } const y: TaskType = { x: 1 }; return y; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'NotificationTaskType']);
  });

  it('reads an alias as written only where a same-named value is in scope', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}function f(TaskType: string) { const x: TaskType = TaskType; return x; }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'NotificationTaskType']);
  });

  it('reads a namespace member as undefined only where a same-named type parameter or enum is in scope', () => {
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}function f<firebaseModel>(x: firebaseModel) { const y: firebaseModel.NotificationTaskType = 'a'; return [x, y]; }\nconst a: firebaseModel.NotificationTaskType = 'a';`)).toEqual([undefined, 'NotificationTaskType']);
    expect(annotationNamesOf(`${TASK_TYPE_NAMESPACE_IMPORT}function f() { enum firebaseModel { A } const y: firebaseModel.NotificationTaskType = 'a'; return [firebaseModel.A, y]; }\nconst a: firebaseModel.NotificationTaskType = 'a';`)).toEqual([undefined, 'NotificationTaskType']);
  });

  it('reads an alias past a same-named parameter of a function type', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}type F = (TaskType: string) => void;\nconst a: TaskType = 'a';`)).toEqual(['NotificationTaskType']);
  });

  it('reads an alias past a same-named class-expression name, but not inside it', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}const C = class TaskType { m() { const y: TaskType = this; return y; } };\nconst a: TaskType = 'a';`)).toEqual([undefined, 'TaskType', 'NotificationTaskType']);
  });

  it('reads an alias past a same-named type alias or interface in a namespace body, but not inside it', () => {
    expect(annotationNamesOf(`${TASK_TYPE_ALIAS_IMPORT}namespace N { type TaskType = number; const x: TaskType = 1; }\nnamespace M { interface TaskType { x: 1 } }\nconst a: TaskType = 'a';`)).toEqual(['TaskType', 'NotificationTaskType']);
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

/**
 * Reads the initializer of the first variable named `probe` in a one-file project with {@link readImportedReference}.
 *
 * @param text - The file's source text.
 * @returns The {@link readImportedReference} result.
 */
function importedReferenceOf(text: string): ImportedReference | undefined {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const probe = apiSources[0].getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((x) => x.getName() === 'probe');
  return readImportedReference(probe?.getInitializer(), buildDereekbImportIndex(apiSources));
}

describe('readImportedReference()', () => {
  const IMPORT = "import { ALL_NOTIFICATION_TASK_TYPES } from 'demo-firebase';\n";
  const ALIAS_IMPORT = "import { ALL_NOTIFICATION_TASK_TYPES as TASK_TYPES } from 'demo-firebase';\n";
  const NAMESPACE_IMPORT = "import * as demoFirebase from 'demo-firebase';\n";
  const NAMED: ImportedReference = { name: 'ALL_NOTIFICATION_TASK_TYPES', moduleSpecifier: 'demo-firebase', text: 'ALL_NOTIFICATION_TASK_TYPES' };
  const ALIASED: ImportedReference = { ...NAMED, text: 'TASK_TYPES' };
  const NAMESPACED: ImportedReference = { ...NAMED, text: 'demoFirebase.ALL_NOTIFICATION_TASK_TYPES' };

  it.each<[string, string, ImportedReference]>([
    ['an unaliased named import with its module', `${IMPORT}const probe = ALL_NOTIFICATION_TASK_TYPES;`, NAMED],
    ['past an `as` cast', `${IMPORT}const probe = ALL_NOTIFICATION_TASK_TYPES as string[];`, NAMED],
    ['an aliased import as the exported name', `${ALIAS_IMPORT}const probe = TASK_TYPES;`, ALIASED],
    ['a namespace member as the member name', `${NAMESPACE_IMPORT}const probe = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;`, NAMESPACED],
    [
      'an @dereekb/* import too; the caller filters it',
      "import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';\nconst probe = ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES;",
      { name: 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', moduleSpecifier: '@dereekb/firebase', text: 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES' }
    ],
    ['through a local const', `${IMPORT}const local = ALL_NOTIFICATION_TASK_TYPES;\nconst probe = local;`, NAMED],
    ['through a chain of four local consts', `${IMPORT}const a = ALL_NOTIFICATION_TASK_TYPES;\nconst b = a;\nconst c = b;\nconst d = c;\nconst probe = d;`, NAMED],
    ['through a local const holding an aliased import', `${ALIAS_IMPORT}const local = TASK_TYPES;\nconst probe = local;`, ALIASED],
    ['through a local const holding a namespace member', `${NAMESPACE_IMPORT}const local = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;\nconst probe = local;`, NAMESPACED],
    ['through a local const of the function around the value', `${IMPORT}function f() {\n  const local = ALL_NOTIFICATION_TASK_TYPES;\n  const probe = local;\n  return probe;\n}`, NAMED],
    ['through the local const in scope, past a same-named const in another function', `${IMPORT}function f() {\n  const local = [];\n  return local;\n}\nconst local = ALL_NOTIFICATION_TASK_TYPES;\nconst probe = local;`, NAMED]
  ])('reads %s', (_label, text, expected) => {
    expect(importedReferenceOf(text)).toEqual(expected);
  });

  it.each([
    ['a name the file does not import', `const probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['a type-only import', `import { type ALL_NOTIFICATION_TASK_TYPES } from 'demo-firebase';\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['a member of a type-only namespace import', `import type * as demoFirebase from 'demo-firebase';\nconst probe = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;`],
    ['a member of a default import', `import demoFirebase from 'demo-firebase';\nconst probe = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;`],
    ['a member of a namespace member', `${NAMESPACE_IMPORT}const probe = demoFirebase.inner.ALL_NOTIFICATION_TASK_TYPES;`],
    ['an import shadowed by a parameter', `${IMPORT}function f(ALL_NOTIFICATION_TASK_TYPES: string[]) { return ALL_NOTIFICATION_TASK_TYPES; }\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['an import shadowed by a local const', `${IMPORT}function f() { const ALL_NOTIFICATION_TASK_TYPES: string[] = []; return ALL_NOTIFICATION_TASK_TYPES; }\nconst probe = ALL_NOTIFICATION_TASK_TYPES;`],
    ['an alias the file also declares', `${ALIAS_IMPORT}function f(TASK_TYPES: string[]) { return TASK_TYPES; }\nconst probe = TASK_TYPES;`],
    ['a namespace the file also declares', `${NAMESPACE_IMPORT}function f(demoFirebase: object) { return demoFirebase; }\nconst probe = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;`],
    ['a let', `${IMPORT}let local = ALL_NOTIFICATION_TASK_TYPES;\nconst probe = local;`],
    ['a local const with another declaration of its name in scope', `${IMPORT}const local = ALL_NOTIFICATION_TASK_TYPES;\nfunction f(local: string[]) {\n  const probe = local;\n  return probe;\n}`],
    ['a local const holding a call', `${IMPORT}const local = ALL_NOTIFICATION_TASK_TYPES.slice();\nconst probe = local;`],
    ['a chain of five local consts, past the hop limit', `${IMPORT}const a = ALL_NOTIFICATION_TASK_TYPES;\nconst b = a;\nconst c = b;\nconst d = c;\nconst e = d;\nconst probe = e;`],
    ['a value that is not an identifier', `${IMPORT}const probe = [...ALL_NOTIFICATION_TASK_TYPES];`]
  ])('reads %s as undefined', (_label, text) => {
    expect(importedReferenceOf(text)).toBeUndefined();
  });

  it('tells @dereekb/* modules apart', () => {
    expect([isDereekbModuleSpecifier('@dereekb/firebase'), isDereekbModuleSpecifier('demo-firebase'), isDereekbModuleSpecifier('./notification.task')]).toEqual([true, false, false]);
  });
});

/**
 * Resolves the identifier of every `return <identifier>;` in a one-file project, in source order.
 *
 * @param text - The file's source text.
 * @returns The resolved declaration's initializer text, or `ambiguous` / `none`.
 */
function resolutionsOf(text: string): (string | undefined)[] {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const imports = buildDereekbImportIndex(apiSources);
  return apiSources[0]
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .map((x) => x.getExpression())
    .filter((x): x is Identifier => x !== undefined && Node.isIdentifier(x))
    .map((reference) => {
      const resolution = resolveLocalVariable(reference, imports);
      return resolution.kind === 'variable' ? resolution.declaration.getInitializer()?.getText() : resolution.kind;
    });
}

describe('resolveLocalVariable()', () => {
  it.each<[string, string, (string | undefined)[]]>([
    ['reads each function its own const', `function f() { const h = a(); return h; }\nfunction g() { const h = b(); return h; }`, ['a()', 'b()']],
    ['resolves a module-level const', `const h = a();\nfunction f() { return h; }`, ['a()']],
    ['resolves a let, and a var from outside its block', `function f() { let h = a(); return h; }\nfunction g(x: boolean) { if (x) { var h = b(); } return h; }`, ['a()', 'b()']],
    ['resolves a const in a switch case', `function f(x: number) { switch (x) { case 1: const h = a(); return h; } return null; }`, ['a()']],
    ['resolves a const declared after the reference in its block', `function f() { const g = () => { return h; }; const h = a(); return g; }`, ['a()', '() => { return h; }']],
    ['ignores an arrow parameter of the same name elsewhere in the function', `function f(list: unknown[]) { const h = a(); list.forEach((h) => h); return h; }`, ['a()']],
    ['does not resolve a const out of its block', `function f(x: boolean) { if (x) { const h = a(); } return h; }`, ['none']],
    ['does not resolve a const out of its function', `function f() { const h = a(); return null; }\nfunction g() { return h; }`, ['none']],
    ['reads a parameter as none, even with a same-named const in another function', `function f() { const h = a(); return h; }\nfunction g(h: unknown) { return h; }`, ['a()', 'none']],
    ['reads a name the file only imports as none', `import { h } from 'x';\nfunction f() { return h; }`, ['none']],
    ['reads a destructured or for-of name as none', `function f(o: any) { const { h } = o; return h; }\nfunction g(list: unknown[]) { for (const h of list) { return h; } return null; }`, ['none', 'none']],
    ['reads two consts in scope as ambiguous', `const h = a();\nfunction f() { const h = b(); return h; }`, ['ambiguous']],
    ['reads a const shadowed by a parameter as ambiguous', `const h = a();\nfunction f(h: unknown) { return h; }`, ['ambiguous']],
    ['reads a const shadowed by an import as ambiguous', `import { h } from 'x';\nfunction f() { const h = a(); return h; }`, ['ambiguous']],
    ['reads a const shadowed by a catch variable as ambiguous', `const h = a();\nfunction f() { try { return null; } catch (h) { return h; } }`, ['ambiguous']],
    ['reads a const next to a same-named function declaration as ambiguous', `function h() { return null; }\nfunction f() { const h = a(); return h; }`, ['ambiguous']]
  ])('%s', (_label, text, expected) => {
    expect(resolutionsOf(text)).toEqual(expected);
  });
});

/**
 * Unwraps the initializer of the top-level `probe` variable of a one-file project with {@link unwrapOuterExpressions}.
 *
 * @param text - The file's source text.
 * @returns The unwrapped expression's text.
 */
function unwrappedProbeOf(text: string): string | undefined {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  return unwrapOuterExpressions(apiSources[0].getVariableDeclarationOrThrow('probe').getInitializer())?.getText();
}

describe('unwrapOuterExpressions()', () => {
  it.each<[string, string]>([
    ['(h)', 'h'],
    ['h!', 'h'],
    ['h as unknown as X', 'h'],
    ['h satisfies X', 'h'],
    ['<X>h', 'h'],
    ['((h as X)!) satisfies Y', 'h'],
    ['(a ? b : c)!', 'a ? b : c'],
    ['f(h!)', 'f(h!)']
  ])('unwraps `%s` to `%s`', (initializer, expected) => {
    expect(unwrappedProbeOf(`const probe = ${initializer};`)).toBe(expected);
  });

  it('returns undefined for undefined', () => {
    expect(unwrapOuterExpressions(undefined)).toBeUndefined();
  });
});

/**
 * Reads {@link findSoleReturnExpression} for the `probe` function of a one-file project: a function declaration, or the
 * function a `probe` variable holds.
 *
 * @param text - The file's source text.
 * @returns The returned expression's text, or `undefined`.
 */
function soleReturnOf(text: string): string | undefined {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: [{ relPath: 'a.ts', text }] } });
  const sf = apiSources[0];
  const fn = sf.getFunction('probe') ?? sf.getVariableDeclarationOrThrow('probe').getInitializerOrThrow();
  return findSoleReturnExpression(fn)?.getText();
}

describe('findSoleReturnExpression()', () => {
  it.each<[string, string, string | undefined]>([
    ['a concise arrow body', 'const probe = (c) => build(c);', 'build(c)'],
    ['the only return of a block body', 'const probe = (c) => { const p = []; return build(c, p); };', 'build(c, p)'],
    ['the only return of a function expression', 'const probe = function (c) { return build(c); };', 'build(c)'],
    ['the only return of a function declaration', 'function probe(c) { return build(c); }', 'build(c)'],
    ['past the returns of a nested function', 'const probe = (c) => { const inner = () => { return other(); }; return build(c, inner); };', 'build(c, inner)'],
    ['nothing for a function that returns from two places', 'const probe = (c) => { if (c) { return undefined; } return build(c); };', undefined],
    ['nothing for a function that returns only from inside a branch', 'const probe = (c) => { if (c) { return a(c); } else { return b(c); } };', undefined],
    ['nothing for a function with no return', 'const probe = (c) => { build(c); };', undefined],
    ['nothing for a bare return', 'const probe = (c) => { build(c); return; };', undefined],
    ['nothing for a value that is not a function', 'const probe = build;', undefined]
  ])('reads %s', (_label, text, expected) => {
    expect(soleReturnOf(text)).toBe(expected);
  });
});
