import { describe, expect, it } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import { buildDereekbImportIndex, buildInMemoryProject, readCalleeName } from './ast.js';

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
