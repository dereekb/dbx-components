import { describe, it, expect } from 'vitest';
import { DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE, type DbxLlmFlowAnySectionConfig, type DbxLlmFlowConfig, type DbxLlmFlowRun, type DbxLlmFlowRunKind, type DbxLlmFlowSectionKey, type DbxLlmFlowState } from './llm.flow';
import {
  type DbxLlmFlowStateContext,
  dbxLlmFlowRunLineage,
  dbxLlmFlowRunsWithInterruptedRuns,
  dbxLlmFlowSectionRunAvailability,
  dbxLlmFlowSectionRunRequest,
  dbxLlmFlowStateWithCompletedRun,
  dbxLlmFlowStateWithConsumedRunRequest,
  dbxLlmFlowStateWithDraft,
  dbxLlmFlowStateWithDraftFormValue,
  dbxLlmFlowStateWithFailedRun,
  dbxLlmFlowStateWithFormValid,
  dbxLlmFlowStateWithImportedRuns,
  dbxLlmFlowStateWithLoadedRun,
  dbxLlmFlowStateWithPastedRawInput,
  dbxLlmFlowStateWithRegisteredSection,
  dbxLlmFlowStateWithRevertedRawInput,
  dbxLlmFlowStateWithRunBridge,
  dbxLlmFlowStateWithRunRequest,
  dbxLlmFlowStateWithStartedRun,
  dbxLlmFlowStateWithUnregisteredSection,
  initialDbxLlmFlowState
} from './llm.flow.state';

interface TestFlow {
  readonly context: DbxLlmFlowStateContext;
  state: DbxLlmFlowState;
}

function makeFlow(configs: DbxLlmFlowAnySectionConfig[], flowConfig?: DbxLlmFlowConfig): TestFlow {
  const map = new Map(configs.map((x) => [x.key, x]));
  let time = 1000;
  let requestId = 0;

  const context: DbxLlmFlowStateContext = {
    get now() {
      time += 1;
      return new Date(time);
    },
    flowConfig,
    sectionConfig: (key) => map.get(key),
    nextRequestId: () => (requestId += 1)
  };

  let state = initialDbxLlmFlowState();

  for (const config of configs) {
    state = dbxLlmFlowStateWithRegisteredSection(state, { key: config.key, parentKey: config.parentKey }, context);
  }

  return { context, state };
}

function startRun(flow: TestFlow, sectionKey: DbxLlmFlowSectionKey, runId: string, kind: DbxLlmFlowRunKind = 'run') {
  const result = dbxLlmFlowStateWithStartedRun(flow.state, { sectionKey, kind, runId }, flow.context);
  flow.state = result.state;
  return result;
}

function completeRun(flow: TestFlow, runId: string, output: unknown) {
  flow.state = dbxLlmFlowStateWithCompletedRun(flow.state, { runId, output }, flow.context);
}

function run(flow: TestFlow, sectionKey: DbxLlmFlowSectionKey, runId: string, output: unknown, kind: DbxLlmFlowRunKind = 'run') {
  const result = startRun(flow, sectionKey, runId, kind);
  expect(result.blockedReason).toBeUndefined();
  completeRun(flow, runId, output);
}

function paste(flow: TestFlow, key: DbxLlmFlowSectionKey, rawInput: string) {
  flow.state = dbxLlmFlowStateWithPastedRawInput(flow.state, { key, rawInput }, flow.context);
}

const FORM_A: DbxLlmFlowAnySectionConfig = { key: 'a', hasForm: true, initialDraft: { formValue: { topic: 'cats' } } };
const TEXT_B: DbxLlmFlowAnySectionConfig = { key: 'b', parentKey: 'a' };
const TEXT_C: DbxLlmFlowAnySectionConfig = { key: 'c', parentKey: 'b' };

describe('llm.flow.state', () => {
  describe('registration', () => {
    it('should create the section with the initial draft as pretty JSON', () => {
      const flow = makeFlow([FORM_A]);
      const section = flow.state.sections['a'];
      expect(section.draft.rawInput).toBe(JSON.stringify({ topic: 'cats' }, null, 2));
      expect(section.mountCount).toBe(1);
      expect(section.inputIssues).toBeUndefined();
    });

    it('should only decrement the mount count when unregistered', () => {
      const flow = makeFlow([FORM_A]);
      const state = dbxLlmFlowStateWithUnregisteredSection(flow.state, 'a');
      expect(state.sections['a'].mountCount).toBe(0);
      expect(state.sections['a'].draft).toBe(flow.state.sections['a'].draft);
    });

    it('should throw on a parentKey cycle', () => {
      const flow = makeFlow([
        { key: 'x', parentKey: 'y' },
        { key: 'y', parentKey: 'z' }
      ]);
      expect(() => dbxLlmFlowStateWithRegisteredSection(flow.state, { key: 'x', parentKey: 'y' }, flow.context)).not.toThrow();
      expect(() => dbxLlmFlowStateWithRegisteredSection(flow.state, { key: 'y', parentKey: 'x' }, flow.context)).toThrow();
    });

    it('should treat an unknown parentKey as a root until the parent registers', () => {
      const flow = makeFlow([TEXT_B, FORM_A]);
      run(flow, 'a', 'a1', 'outline');
      expect(flow.state.sections['b'].followedParentRunId).toBe('a1');
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline');
    });

    it('should reconcile a late-registered child against the parent selection without auto-running', () => {
      const flow = makeFlow([FORM_A]);
      run(flow, 'a', 'a1', 'outline');
      flow.state = dbxLlmFlowStateWithRegisteredSection(flow.state, { key: 'b', parentKey: 'a' }, flow.context);
      expect(flow.state.sections['b'].followedParentRunId).toBe('a1');
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline');
      expect(flow.state.runRequests['b']).toBeUndefined();
    });
  });

  describe('cascade', () => {
    it('should derive descendants from a completed run and restore them when an earlier run is loaded', () => {
      const flow = makeFlow([FORM_A, TEXT_B, TEXT_C]);
      run(flow, 'a', 'a1', 'outline 1');
      run(flow, 'b', 'b1', 'draft 1');
      run(flow, 'a', 'a2', 'outline 2');

      expect(flow.state.sections['b'].followedParentRunId).toBe('a2');
      expect(flow.state.sections['b'].selectedRunIds).toEqual([]);
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline 2');
      expect(flow.state.sections['c'].selectedRunIds).toEqual([]);
      expect(flow.state.sections['c'].followedParentRunId).toBeUndefined();

      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'a1' }, flow.context);
      expect(loaded.loaded).toBe(true);
      expect(loaded.state.sections['a'].selectedRunIds).toEqual(['a1']);
      expect(loaded.state.sections['b'].selectedRunIds).toEqual(['b1']);
      expect(loaded.state.sections['b'].followedParentRunId).toBe('a1');
      expect(loaded.state.sections['b'].draft.rawInput).toBe('outline 1');
      expect(loaded.state.sections['c'].followedParentRunId).toBe('b1');
      expect(loaded.state.sections['c'].draft.rawInput).toBe('draft 1');
    });

    it('should keep one selection per kind, with the latest last', () => {
      const flow = makeFlow([{ ...FORM_A, kinds: [{ kind: 'plan' }, { kind: 'render' }] }]);
      run(flow, 'a', 'p1', 'p', 'plan');
      run(flow, 'a', 'r1', 'r', 'render');
      expect(flow.state.sections['a'].selectedRunIds).toEqual(['p1', 'r1']);
      run(flow, 'a', 'p2', 'p', 'plan');
      expect(flow.state.sections['a'].selectedRunIds).toEqual(['r1', 'p2']);
    });

    it('should only cascade to children that follow the run kind', () => {
      const flow = makeFlow([
        { ...FORM_A, kinds: [{ kind: 'plan' }, { kind: 'render' }] },
        { ...TEXT_B, followParentKinds: ['plan'] }
      ]);
      run(flow, 'a', 'p1', 'plan output', 'plan');
      run(flow, 'a', 'r1', 'render output', 'render');
      expect(flow.state.sections['b'].followedParentRunId).toBe('p1');
      expect(flow.state.sections['b'].draft.rawInput).toBe('plan output');
    });

    it('should load a run with its ancestors along the forced path', () => {
      const flow = makeFlow([FORM_A, TEXT_B]);
      paste(flow, 'a', '{"topic":"dogs"}');
      run(flow, 'a', 'a1', 'outline 1');
      run(flow, 'b', 'b1', 'draft 1');
      paste(flow, 'a', '{"topic":"birds"}');
      run(flow, 'a', 'a2', 'outline 2');
      run(flow, 'b', 'b2', 'draft 2');

      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'b1', withAncestors: true }, flow.context);
      expect(loaded.loaded).toBe(true);
      expect(loaded.state.sections['a'].selectedRunIds).toEqual(['a1']);
      expect(loaded.state.sections['a'].draft.formValue).toEqual({ topic: 'dogs' });
      expect(loaded.state.sections['b'].selectedRunIds).toEqual(['b1']);
      expect(loaded.state.sections['b'].followedParentRunId).toBe('a1');
    });

    it('should allow loading an off-branch run without ancestors', () => {
      const flow = makeFlow([FORM_A, TEXT_B]);
      run(flow, 'a', 'a1', 'outline 1');
      run(flow, 'b', 'b1', 'draft 1');
      run(flow, 'a', 'a2', 'outline 2');

      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'b1' }, flow.context);
      expect(loaded.state.sections['b'].selectedRunIds).toEqual(['b1']);
      expect(loaded.state.sections['b'].followedParentRunId).toBe('a2');
    });

    it('should not load while the section runs', () => {
      const flow = makeFlow([FORM_A]);
      run(flow, 'a', 'a1', 'x');
      startRun(flow, 'a', 'a2');
      expect(dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'a1' }, flow.context).loaded).toBe(false);
    });
  });

  describe('completion', () => {
    it('should only record an off-branch completion in history', () => {
      const flow = makeFlow([FORM_A, TEXT_B]);
      run(flow, 'a', 'a1', 'outline 1');
      startRun(flow, 'b', 'b1');
      run(flow, 'a', 'a2', 'outline 2');
      completeRun(flow, 'b1', 'draft');

      expect(flow.state.runs['b1'].state).toBe('success');
      expect(flow.state.sections['b'].selectedRunIds).toEqual([]);
      expect(flow.state.sections['b'].activeRunId).toBeUndefined();
    });

    it('should be idempotent', () => {
      const flow = makeFlow([FORM_A]);
      run(flow, 'a', 'a1', 'x');
      const state = flow.state;
      expect(dbxLlmFlowStateWithCompletedRun(state, { runId: 'a1', output: 'y' }, flow.context)).toBe(state);
      expect(dbxLlmFlowStateWithFailedRun(state, { runId: 'a1' }, flow.context)).toBe(state);
    });

    it('should fail a run with a non-JSON output', () => {
      const flow = makeFlow([FORM_A]);
      startRun(flow, 'a', 'a1');
      completeRun(flow, 'a1', { when: new Date() });
      expect(flow.state.runs['a1'].state).toBe('failed');
      expect(flow.state.runs['a1'].error?.code).toBe(DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE);
      expect(flow.state.runs['a1'].error?.message).toContain('when');
      expect(flow.state.sections['a'].lastFailedRunId).toBe('a1');
    });

    it('should never select a failed run, and loading it restores its input only', () => {
      const flow = makeFlow([FORM_A]);
      run(flow, 'a', 'a1', 'x');
      paste(flow, 'a', '{"topic":"fail"}');
      startRun(flow, 'a', 'a2');
      flow.state = dbxLlmFlowStateWithFailedRun(flow.state, { runId: 'a2', error: { message: 'nope' } }, flow.context);
      paste(flow, 'a', '{"topic":"other"}');

      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'a2' }, flow.context);
      expect(loaded.state.sections['a'].draft.formValue).toEqual({ topic: 'fail' });
      expect(loaded.state.sections['a'].selectedRunIds).toEqual(['a1']);
    });

    it('should build the lineage root first', () => {
      const flow = makeFlow([FORM_A, TEXT_B, TEXT_C]);
      run(flow, 'a', 'a1', 'x');
      run(flow, 'b', 'b1', 'y');
      const result = startRun(flow, 'c', 'c1');
      expect(result.value?.parentRun?.id).toBe('b1');
      expect(result.value?.lineage.map((x) => x.id)).toEqual(['a1', 'b1']);
      expect(dbxLlmFlowRunLineage(flow.state, 'c1').map((x) => x.id)).toEqual(['a1', 'b1', 'c1']);
    });
  });

  describe('gating', () => {
    function blockedReason(flow: TestFlow, key: DbxLlmFlowSectionKey) {
      return dbxLlmFlowSectionRunAvailability(flow.state, key, flow.context).blockedReason;
    }

    it('should block while restoring', () => {
      const flow = makeFlow([FORM_A]);
      flow.state = { ...flow.state, restoring: true };
      expect(blockedReason(flow, 'a')).toBe('restoring');
    });

    it('should block a second kind while the first runs', () => {
      const flow = makeFlow([{ ...FORM_A, kinds: [{ kind: 'plan' }, { kind: 'render' }] }]);
      startRun(flow, 'a', 'a1', 'plan');
      expect(startRun(flow, 'a', 'a2', 'render').blockedReason).toBe('running');
    });

    it('should block every section while any runs when runs are exclusive', () => {
      const flow = makeFlow([FORM_A, { key: 'x', initialDraft: { rawInput: 'x' } }], { exclusiveRuns: true });
      startRun(flow, 'a', 'a1');
      expect(blockedReason(flow, 'x')).toBe('exclusive_running');
    });

    it('should block while an ancestor runs a kind the path follows', () => {
      const flow = makeFlow([
        { ...FORM_A, kinds: [{ kind: 'plan' }, { kind: 'render' }] },
        { ...TEXT_B, followParentKinds: ['plan'], initialDraft: { rawInput: 'b' } }
      ]);
      startRun(flow, 'a', 'r1', 'render');
      expect(blockedReason(flow, 'b')).toBeUndefined();
      completeRun(flow, 'r1', 'r');
      startRun(flow, 'a', 'p1', 'plan');
      expect(blockedReason(flow, 'b')).toBe('ancestor_running');
    });

    it('should require a parent run when configured', () => {
      const flow = makeFlow([FORM_A, { ...TEXT_B, requireParentRun: true, initialDraft: { rawInput: 'b' } }]);
      expect(blockedReason(flow, 'b')).toBe('parent_run_required');
    });

    it('should block empty input unless allowed', () => {
      expect(blockedReason(makeFlow([{ key: 'x' }]), 'x')).toBe('invalid_input');
      expect(blockedReason(makeFlow([{ key: 'x', allowEmptyInput: true }]), 'x')).toBeUndefined();
    });

    it('should block on validateInput messages', () => {
      const flow = makeFlow([{ ...FORM_A, validateInput: (input) => ((input.formValue as { topic?: string })?.topic === 'cats' ? 'No cats.' : undefined) }]);
      expect(blockedReason(flow, 'a')).toBe('invalid_input');
      expect(flow.state.sections['a'].inputIssues).toEqual(['No cats.']);
      paste(flow, 'a', '{"topic":"dogs"}');
      expect(blockedReason(flow, 'a')).toBeUndefined();
    });

    it('should block on a non-JSON form value', () => {
      const flow = makeFlow([FORM_A]);
      flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'a', bindingId: 1, formValue: { topic: 'x', when: new Date() } }, flow.context);
      expect(blockedReason(flow, 'a')).toBe('invalid_input');
      expect(flow.state.sections['a'].draft.formValue).toEqual({ topic: 'cats' });
      expect(flow.state.sections['a'].inputIssues?.[0]).toContain('when');
    });

    it('should block an invalid form unless the raw input is overridden', () => {
      const flow = makeFlow([{ ...FORM_A, rawInput: { mode: 'one-way' } }]);
      flow.state = dbxLlmFlowStateWithFormValid(flow.state, { key: 'a', valid: false });
      expect(blockedReason(flow, 'a')).toBe('invalid_form');
      paste(flow, 'a', 'free text');
      expect(blockedReason(flow, 'a')).toBeUndefined();
    });
  });

  describe('raw input', () => {
    it('should parse a two-way paste back into the form value', () => {
      const flow = makeFlow([FORM_A]);
      const revision = flow.state.sections['a'].draftRevision;
      paste(flow, 'a', '{"topic":"dogs"}');
      const section = flow.state.sections['a'];
      expect(section.draft.formValue).toEqual({ topic: 'dogs' });
      expect(section.draft.rawInput).toBe(JSON.stringify({ topic: 'dogs' }, null, 2));
      expect(section.draft.rawInputOverridden).toBe(false);
      expect(section.draftRevision).toBe(revision + 1);
      expect(section.draftSource).toBeUndefined();
    });

    it('should fall back to one-way with a message when a two-way paste fails to parse', () => {
      const flow = makeFlow([FORM_A]);
      paste(flow, 'a', 'not json');
      const section = flow.state.sections['a'];
      expect(section.draft.rawInput).toBe('not json');
      expect(section.draft.rawInputOverridden).toBe(true);
      expect(section.rawInputParseError).toBeDefined();
      expect(section.inputIssues?.length).toBe(1);
    });

    it('should keep the exact text in one-way mode, ignore form pushes, and revert', () => {
      const flow = makeFlow([{ ...FORM_A, rawInput: { mode: 'one-way' } }]);
      paste(flow, 'a', '{"topic":"dogs"}');
      expect(flow.state.sections['a'].draft.rawInput).toBe('{"topic":"dogs"}');
      expect(flow.state.sections['a'].draft.formValue).toEqual({ topic: 'cats' });

      const state = flow.state;
      expect(dbxLlmFlowStateWithDraftFormValue(state, { key: 'a', bindingId: 1, formValue: { topic: 'x' } }, flow.context)).toBe(state);

      flow.state = dbxLlmFlowStateWithRevertedRawInput(flow.state, 'a', flow.context);
      expect(flow.state.sections['a'].draft.rawInputOverridden).toBe(false);
      expect(flow.state.sections['a'].draft.rawInput).toBe(JSON.stringify({ topic: 'cats' }, null, 2));
    });

    it('should ignore pastes in readonly mode', () => {
      const flow = makeFlow([{ ...FORM_A, rawInput: { mode: 'readonly' } }]);
      const state = flow.state;
      paste(flow, 'a', 'x');
      expect(flow.state).toBe(state);
    });
  });

  describe('form bindings', () => {
    it('should record the binding as the draft source and no-op on an echo', () => {
      const flow = makeFlow([FORM_A]);
      flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'a', bindingId: 1, formValue: { topic: 'dogs' } }, flow.context);
      const section = flow.state.sections['a'];
      expect(section.draftSource).toBe(1);
      expect(section.draft.rawInput).toBe(JSON.stringify({ topic: 'dogs' }, null, 2));

      const state = flow.state;
      expect(dbxLlmFlowStateWithDraftFormValue(state, { key: 'a', bindingId: 2, formValue: { topic: 'dogs', empty: '' } }, flow.context)).toBe(state);

      flow.state = dbxLlmFlowStateWithDraftFormValue(state, { key: 'a', bindingId: 2, formValue: { topic: 'birds' } }, flow.context);
      expect(flow.state.sections['a'].draftSource).toBe(2);
      expect(flow.state.sections['a'].draftRevision).toBe(section.draftRevision + 1);
    });
  });

  describe('run requests', () => {
    it('should only request when a bridge is mounted, go stale on draft change, and be consumed once', () => {
      const flow = makeFlow([FORM_A]);
      expect(dbxLlmFlowStateWithRunRequest(flow.state, { key: 'a', kind: 'run' }, flow.context).requested).toBe(false);

      flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'a', kind: 'run', mounted: true });
      const requested = dbxLlmFlowStateWithRunRequest(flow.state, { key: 'a', kind: 'run' }, flow.context);
      expect(requested.requested).toBe(true);
      flow.state = requested.state;

      const request = dbxLlmFlowSectionRunRequest(flow.state, 'a', 'run');
      expect(request).toBeDefined();

      const consumed = dbxLlmFlowStateWithConsumedRunRequest(flow.state, { key: 'a', requestId: request!.id });
      expect(consumed.consumed).toBe(true);
      expect(dbxLlmFlowStateWithConsumedRunRequest(consumed.state, { key: 'a', requestId: request!.id }).consumed).toBe(false);

      flow.state = dbxLlmFlowStateWithRunRequest(flow.state, { key: 'a', kind: 'run' }, flow.context).state;
      paste(flow, 'a', '{"topic":"dogs"}');
      expect(dbxLlmFlowSectionRunRequest(flow.state, 'a', 'run')).toBeUndefined();
    });

    it('should reroll by loading the run input and requesting its kind', () => {
      const flow = makeFlow([FORM_A]);
      flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'a', kind: 'run', mounted: true });
      run(flow, 'a', 'a1', 'x');
      paste(flow, 'a', '{"topic":"dogs"}');

      flow.state = dbxLlmFlowStateWithDraft(flow.state, { key: 'a', input: flow.state.runs['a1'].input }, flow.context);
      flow.state = dbxLlmFlowStateWithRunRequest(flow.state, { key: 'a', kind: 'run' }, flow.context).state;

      expect(flow.state.sections['a'].draft.formValue).toEqual({ topic: 'cats' });
      expect(dbxLlmFlowSectionRunRequest(flow.state, 'a', 'run')).toBeDefined();
    });

    it('should auto-run a child after a parent completes, but not after a load', () => {
      const flow = makeFlow([FORM_A, { ...TEXT_B, autoRunAfterParent: true }]);
      flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'b', kind: 'run', mounted: true });
      run(flow, 'a', 'a1', 'outline 1');
      expect(dbxLlmFlowSectionRunRequest(flow.state, 'b', 'run')).toBeDefined();

      run(flow, 'b', 'b1', 'draft');
      run(flow, 'a', 'a2', 'outline 2');
      flow.state = { ...flow.state, runRequests: {} };

      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'a2' }, flow.context);
      expect(loaded.state.runRequests['b']).toBeUndefined();
    });
  });

  describe('import', () => {
    function importedRun(id: string, sectionKey: DbxLlmFlowSectionKey, output: unknown, extra?: Partial<DbxLlmFlowRun>): DbxLlmFlowRun {
      return { id, sectionKey, kind: 'run', input: { rawInput: 'x' }, state: 'success', output, startedAt: new Date(500), ...extra };
    }

    it('should skip non-JSON runs, interrupt running runs, and honor the duplicates mode', () => {
      const flow = makeFlow([FORM_A]);
      run(flow, 'a', 'a1', 'local');

      const result = dbxLlmFlowStateWithImportedRuns(flow.state, { runs: [importedRun('s1', 'a', { d: new Date() }), importedRun('s2', 'a', 'ok', { state: 'running' }), importedRun('a1', 'a', 'server')] }, flow.context);
      expect(result.skipped.map((x) => x.id)).toEqual(['s1', 'a1']);
      expect(result.state.runs['s2'].state).toBe('failed');
      expect(result.state.runs['s2'].error?.code).toBe(DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE);
      expect(result.state.runs['a1'].output).toBe('local');

      const replaced = dbxLlmFlowStateWithImportedRuns(flow.state, { runs: [importedRun('a1', 'a', 'server')], duplicates: 'replace' }, flow.context);
      expect(replaced.state.runs['a1'].output).toBe('server');
      expect(replaced.state.runs['a1'].imported).toBe(true);
    });

    it('should select the latest imported run and cascade without auto-running', () => {
      const flow = makeFlow([FORM_A, { ...TEXT_B, autoRunAfterParent: true }]);
      flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'b', kind: 'run', mounted: true });
      const result = dbxLlmFlowStateWithImportedRuns(flow.state, { runs: [importedRun('s1', 'a', 'one'), importedRun('s2', 'a', 'two', { startedAt: new Date(600) })], selectLatest: true }, flow.context);
      expect(result.state.sections['a'].selectedRunIds).toEqual(['s2']);
      expect(result.state.sections['b'].draft.rawInput).toBe('two');
      expect(result.state.runRequests['b']).toBeUndefined();
    });
  });

  describe('restore helpers', () => {
    it('should mark running runs as interrupted', () => {
      const runs = dbxLlmFlowRunsWithInterruptedRuns({ r1: { id: 'r1', sectionKey: 'a', kind: 'run', input: { rawInput: '' }, state: 'running', startedAt: new Date() } }, new Date());
      expect(runs['r1'].state).toBe('failed');
      expect(runs['r1'].error?.code).toBe(DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE);
    });
  });
});
