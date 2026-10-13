import { describe, expect, it } from 'vitest';
import { findRule } from '../_core/rule-catalog/index.js';
import { checkHandlerMcpReadOnly, isMcpReadOnlyInferredVerb } from './mcp-read-only.js';
import { reconcile } from './reconcile.js';
import type { HandlerEntry, HandlerMcpReadOnly } from './types.js';

const DECLARATION_SOURCE = 'apps/x-api/src/app/function/thing/thing.invoke.ts:12';

function invokeHandler(mcpReadOnly: HandlerMcpReadOnly | undefined, verb: HandlerEntry['verb'] = 'invoke'): HandlerEntry {
  return { model: 'thing', verb, specifier: 'check', handlerName: 'thingCheck', sourceFile: 'apps/x-api/src/app/function/model/crud.functions.ts', line: 40, mcpReadOnly };
}

describe('isMcpReadOnlyInferredVerb()', () => {
  it('is true for the call types whose classification MCP infers', () => {
    for (const verb of ['read', 'query', 'create', 'update', 'delete']) {
      expect(isMcpReadOnlyInferredVerb(verb)).toBe(true);
    }
  });

  it('is false for invoke and custom verbs', () => {
    expect(isMcpReadOnlyInferredVerb('invoke')).toBe(false);
    expect(isMcpReadOnlyInferredVerb('archive')).toBe(false);
  });
});

describe('checkHandlerMcpReadOnly()', () => {
  it('warns about an invoke handler without an mcp block', () => {
    const issue = checkHandlerMcpReadOnly(invokeHandler({ kind: 'unset', hasMcp: false, declarationSource: DECLARATION_SOURCE }));
    expect(issue?.code).toBe('HANDLER_MCP_READ_ONLY_UNSET');
    expect(issue?.severity).toBe('warning');
    expect(issue?.source).toBe(DECLARATION_SOURCE);
    expect(issue?.message).toContain('`thingCheck`');
    expect(issue?.message).toContain('`thing.invoke.check`');
    expect(issue?.message).toContain('no `mcp` block');
  });

  it('warns about an invoke handler with an mcp block without readOnly', () => {
    const issue = checkHandlerMcpReadOnly(invokeHandler({ kind: 'unset', hasMcp: true, declarationSource: DECLARATION_SOURCE }));
    expect(issue?.message).toContain('without `readOnly`');
  });

  it.each<[string, HandlerMcpReadOnly | undefined]>([
    ['declared', { kind: 'declared', value: true, declarationSource: DECLARATION_SOURCE }],
    ['declared to a non-literal', { kind: 'declared', value: undefined, declarationSource: DECLARATION_SOURCE }],
    ['noApiDetails', { kind: 'noApiDetails', declarationSource: DECLARATION_SOURCE }],
    ['unresolved', { kind: 'unresolved', reason: 'imported from `@dereekb/firebase-server/model`' }],
    ['missing', undefined]
  ])('does not warn about a %s status', (_label, status) => {
    expect(checkHandlerMcpReadOnly(invokeHandler(status))).toBeUndefined();
  });

  it('does not warn under a call type that decides', () => {
    expect(checkHandlerMcpReadOnly(invokeHandler({ kind: 'unset', hasMcp: false, declarationSource: DECLARATION_SOURCE }, 'update'))).toBeUndefined();
  });

  it('matches its rule catalog entry', () => {
    expect(findRule('HANDLER_MCP_READ_ONLY_UNSET')?.severity).toBe('warning');
  });
});

describe('reconcile() severities', () => {
  it('counts errors and warnings apart', () => {
    const result = reconcile({
      declared: [],
      handlers: [invokeHandler({ kind: 'unset', hasMcp: false, declarationSource: DECLARATION_SOURCE })]
    });
    expect(result.issues.map((x) => `${x.code}:${x.severity}`).sort()).toEqual(['HANDLER_MCP_READ_ONLY_UNSET:warning', 'ORPHAN_HANDLER:error']);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
    const summary = result.summaries.find((x) => x.model === 'thing');
    expect(summary?.errorCount).toBe(1);
    expect(summary?.warningCount).toBe(1);
  });

  it('keeps the reconciliation and naming codes errors', () => {
    const result = reconcile({
      declared: [{ model: 'thing', verb: 'update', specifier: 'x', paramsTypeName: undefined, resultTypeName: undefined, sourceFile: 'thing.api.ts', line: 1 }],
      handlers: [{ model: 'thing', verb: 'invoke', specifier: 'check', handlerName: 'wrongName', sourceFile: 'crud.functions.ts', line: 2 }]
    });
    expect(result.issues.map((x) => `${x.code}:${x.severity}`).sort()).toEqual(['HANDLER_NAMING_MISMATCH:error', 'MISSING_HANDLER:error', 'ORPHAN_HANDLER:error']);
    expect(result.warningCount).toBe(0);
  });
});
