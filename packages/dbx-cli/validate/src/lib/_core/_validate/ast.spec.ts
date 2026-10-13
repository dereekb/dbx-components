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
