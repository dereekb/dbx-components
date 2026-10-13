import { describe, expect, it } from 'vitest';
import type { Maybe } from '@dereekb/util';
import { findRule } from '../_core/rule-catalog/index.js';
import { checkDeclaredDescription } from './description.js';
import { reconcile } from './reconcile.js';
import type { DeclaredEntry } from './types.js';

const SOURCE_FILE = 'components/x-firebase/src/lib/model/thing/thing.api.ts';

interface DeclaredThingInput {
  readonly specifier?: string;
  readonly paramsTypeName?: string;
  readonly description?: Maybe<string>;
  readonly paramsTypeDescription?: Maybe<string>;
}

function declaredThing(input: DeclaredThingInput = {}): DeclaredEntry {
  return { model: 'thing', verb: 'delete', specifier: input.specifier, paramsTypeName: input.paramsTypeName, resultTypeName: undefined, description: input.description, paramsTypeDescription: input.paramsTypeDescription, sourceFile: SOURCE_FILE, line: 40 };
}

describe('checkDeclaredDescription()', () => {
  it('warns about an entry without a config member or params interface summary', () => {
    const issue = checkDeclaredDescription(declaredThing({ paramsTypeName: 'DeleteThingParams' }));
    expect(issue?.code).toBe('MISSING_DESCRIPTION');
    expect(issue?.severity).toBe('warning');
    expect(issue?.source).toBe(`${SOURCE_FILE}:40`);
    expect(issue?.message).toContain('`delete` member');
    expect(issue?.message).toContain('`DeleteThingParams`');
  });

  it('names the specifier member of a nested verb map', () => {
    const issue = checkDeclaredDescription(declaredThing({ specifier: 'archive' }));
    expect(issue?.message).toContain('`archive` member');
  });

  it('leaves out the params clause when the entry has no params type', () => {
    const issue = checkDeclaredDescription(declaredThing());
    expect(issue?.message).not.toContain('params interface');
  });

  it.each<[string, DeclaredThingInput]>([
    ['a config member summary', { description: 'Deletes the thing.' }],
    ['a params interface summary', { paramsTypeName: 'DeleteThingParams', paramsTypeDescription: 'Params for deleting a thing.' }]
  ])('does not warn about an entry with %s', (_label, input) => {
    expect(checkDeclaredDescription(declaredThing(input))).toBeUndefined();
  });

  it('matches its rule catalog entry', () => {
    expect(findRule('MISSING_DESCRIPTION')?.severity).toBe('warning');
  });
});

describe('reconcile() with MISSING_DESCRIPTION', () => {
  it('counts the missing description as a warning on the declared model', () => {
    const result = reconcile({
      declared: [declaredThing()],
      handlers: [{ model: 'thing', verb: 'delete', specifier: undefined, handlerName: 'thingDelete', sourceFile: 'crud.functions.ts', line: 2 }]
    });
    expect(result.issues.map((x) => `${x.code}:${x.severity}`)).toEqual(['MISSING_DESCRIPTION:warning']);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.summaries.find((x) => x.model === 'thing')?.warningCount).toBe(1);
  });

  it('honors the model filter', () => {
    const result = reconcile({ declared: [declaredThing()], handlers: [], modelFilter: 'other' });
    expect(result.issues).toEqual([]);
  });
});
