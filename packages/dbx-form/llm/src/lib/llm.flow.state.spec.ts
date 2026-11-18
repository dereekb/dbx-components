import { describe, it, expect } from 'vitest';
import { type Maybe } from '@dereekb/util';
import {
  DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE,
  DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE,
  DBX_LLM_FLOW_STATE_RUN_KIND,
  type DbxLlmFlowAnySectionConfig,
  type DbxLlmFlowConfig,
  type DbxLlmFlowRun,
  type DbxLlmFlowRunKind,
  type DbxLlmFlowSectionKey,
  type DbxLlmFlowState,
  dbxLlmFlowLineageRun,
  isDbxLlmFlowStateRun
} from './llm.flow';
import {
  type DbxLlmFlowStateContext,
  dbxLlmFlowHistoryLimits,
  dbxLlmFlowHistoryRunIdsToKeep,
  dbxLlmFlowRunLineage,
  dbxLlmFlowRunsWithInterruptedRuns,
  dbxLlmFlowSectionInputSource,
  dbxLlmFlowSectionRunAvailability,
  dbxLlmFlowSectionRunRequest,
  dbxLlmFlowSectionStepNumber,
  dbxLlmFlowStateWithCompletedRun,
  dbxLlmFlowStateWithConsumedRunRequest,
  dbxLlmFlowStateWithDraft,
  dbxLlmFlowSectionOptionsDescription,
  dbxLlmFlowStateWithDraftFormValue,
  dbxLlmFlowStateWithFailedRun,
  dbxLlmFlowStateWithFormValid,
  dbxLlmFlowStateWithFormValue,
  dbxLlmFlowStateWithImportedRuns,
  dbxLlmFlowStateWithLoadedRun,
  dbxLlmFlowStateWithPastedRawInput,
  dbxLlmFlowStateWithPrunedRuns,
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
  let stateRunId = 0;

  const context: DbxLlmFlowStateContext = {
    get now() {
      time += 1;
      return new Date(time);
    },
    flowConfig,
    sectionConfig: (key) => map.get(key),
    nextRequestId: () => (requestId += 1),
    nextRunId: () => `s${(stateRunId += 1)}`
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

function type(flow: TestFlow, key: DbxLlmFlowSectionKey, rawInput: string) {
  flow.state = dbxLlmFlowStateWithPastedRawInput(flow.state, { key, rawInput, typed: true }, flow.context);
}

function inputSource(flow: TestFlow, key: DbxLlmFlowSectionKey) {
  return dbxLlmFlowSectionInputSource(flow.state.sections[key], flow.context.sectionConfig(key));
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

    it('should parse typed two-way text into the form value and keep the text as typed', () => {
      const flow = makeFlow([FORM_A]);
      type(flow, 'a', '{"topic":"dogs"}');
      const section = flow.state.sections['a'];
      expect(section.draft.formValue).toEqual({ topic: 'dogs' });
      expect(section.draft.rawInput).toBe('{"topic":"dogs"}');
      expect(section.draft.rawInputOverridden).toBe(false);
      expect(inputSource(flow, 'a')).toBe('form');
    });

    it('should override the form with typed two-way text that does not parse, until it parses', () => {
      const flow = makeFlow([FORM_A]);
      type(flow, 'a', '{"topic":');
      expect(flow.state.sections['a'].draft.rawInputOverridden).toBe(true);
      expect(flow.state.sections['a'].rawInputParseError).toBeDefined();
      expect(inputSource(flow, 'a')).toBe('manual');

      type(flow, 'a', '{"topic":"dogs"}');
      expect(flow.state.sections['a'].draft.rawInputOverridden).toBe(false);
      expect(flow.state.sections['a'].rawInputParseError).toBeUndefined();
      expect(flow.state.sections['a'].draft.formValue).toEqual({ topic: 'dogs' });
    });

    it('should ignore typed text in one-way mode', () => {
      const flow = makeFlow([{ ...FORM_A, rawInput: { mode: 'one-way' } }]);
      const state = flow.state;
      type(flow, 'a', 'x');
      expect(flow.state).toBe(state);
    });

    it('should mark text typed over a parent output as manual, and revert it to the parent output', () => {
      const flow = makeFlow([FORM_A, TEXT_B]);
      expect(inputSource(flow, 'b')).toBe('none');

      run(flow, 'a', 'a1', 'outline');
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline');
      expect(inputSource(flow, 'b')).toBe('parent');

      type(flow, 'b', 'my outline');
      expect(flow.state.sections['b'].draft.rawInputOverridden).toBe(true);
      expect(inputSource(flow, 'b')).toBe('manual');

      flow.state = dbxLlmFlowStateWithRevertedRawInput(flow.state, 'b', flow.context);
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline');
      expect(flow.state.sections['b'].draft.rawInputOverridden).toBe(false);
      expect(inputSource(flow, 'b')).toBe('parent');
    });

    describe('a form section whose raw input source is "parent"', () => {
      const OPTIONS_B: DbxLlmFlowAnySectionConfig = { key: 'b', parentKey: 'a', hasForm: true, initialDraft: { formValue: { count: 1 } }, rawInput: { source: 'parent' } };

      it('should start with an empty raw input, not one generated from the form value', () => {
        const flow = makeFlow([FORM_A, OPTIONS_B]);
        expect(flow.state.sections['b'].draft.rawInput).toBe('');
        expect(inputSource(flow, 'b')).toBe('none');
      });

      it('should take a string parent output as the raw input, keeping the form value', () => {
        const flow = makeFlow([FORM_A, OPTIONS_B]);
        run(flow, 'a', 'a1', 'outline');

        expect(flow.state.sections['b'].draft.rawInput).toBe('outline');
        expect(flow.state.sections['b'].draft.formValue).toEqual({ count: 1 });
        expect(inputSource(flow, 'b')).toBe('parent');
      });

      it('should keep the raw input when the form value changes', () => {
        const flow = makeFlow([FORM_A, OPTIONS_B]);
        run(flow, 'a', 'a1', 'outline');
        flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'b', bindingId: 1, formValue: { count: 3 } }, flow.context);

        expect(flow.state.sections['b'].draft).toEqual({ formValue: { count: 3 }, rawInput: 'outline', rawInputOverridden: false });
        expect(inputSource(flow, 'b')).toBe('parent');
      });

      it('should default to editable: typed text overrides the parent output without parsing into the form', () => {
        const flow = makeFlow([FORM_A, OPTIONS_B]);
        run(flow, 'a', 'a1', 'outline');
        type(flow, 'b', '{"count":5}');

        expect(flow.state.sections['b'].draft).toEqual({ formValue: { count: 1 }, rawInput: '{"count":5}', rawInputOverridden: true });
        expect(inputSource(flow, 'b')).toBe('manual');
      });

      it('should accept form changes while the raw input is overridden, and revert to the parent output', () => {
        const flow = makeFlow([FORM_A, OPTIONS_B]);
        run(flow, 'a', 'a1', 'outline');
        type(flow, 'b', 'my text');
        flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'b', bindingId: 1, formValue: { count: 2 } }, flow.context);

        expect(flow.state.sections['b'].draft).toEqual({ formValue: { count: 2 }, rawInput: 'my text', rawInputOverridden: true });

        flow.state = dbxLlmFlowStateWithRevertedRawInput(flow.state, 'b', flow.context);
        expect(flow.state.sections['b'].draft).toEqual({ formValue: { count: 2 }, rawInput: 'outline', rawInputOverridden: false });
      });
    });

    it('should treat a section with option fields like a raw input source of "parent"', () => {
      const optionsB: DbxLlmFlowAnySectionConfig = { key: 'b', parentKey: 'a', optionFields: [{ key: 'count', type: 'input' } as never], initialDraft: { formValue: { count: 1 } } };
      const flow = makeFlow([FORM_A, optionsB]);
      run(flow, 'a', 'a1', 'outline');
      flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'b', bindingId: 1, formValue: { count: 4 } }, flow.context);

      expect(flow.state.sections['b'].draft).toEqual({ formValue: { count: 4 }, rawInput: 'outline', rawInputOverridden: false });
      expect(inputSource(flow, 'b')).toBe('parent');
    });

    it('should replace manual text when a new parent run completes', () => {
      const flow = makeFlow([FORM_A, TEXT_B]);
      run(flow, 'a', 'a1', 'outline');
      type(flow, 'b', 'my outline');
      run(flow, 'a', 'a2', 'outline 2');
      expect(flow.state.sections['b'].draft.rawInput).toBe('outline 2');
      expect(inputSource(flow, 'b')).toBe('parent');
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

describe('dbxLlmFlowSectionOptionsDescription()', () => {
  const FIELDS = [
    { key: 'count', type: 'input', label: 'Renders (N)' },
    {
      type: 'row',
      fields: [
        { key: 'style', type: 'select', label: 'Style' },
        { key: 'tags', type: 'input' }
      ]
    },
    { key: 'advanced', type: 'group', fields: [{ key: 'seed', type: 'input', label: 'Seed' }] }
  ] as never[];

  it('should list the options with values by label, falling back to the key, through rows and groups', () => {
    expect(dbxLlmFlowSectionOptionsDescription(FIELDS, { count: 4, style: 'flat', tags: ['a', 'b'], advanced: { seed: 7 } })).toBe('Renders (N): 4 · Style: flat · tags: a, b · Seed: 7');
  });

  it('should skip options without a value', () => {
    expect(dbxLlmFlowSectionOptionsDescription(FIELDS, { count: 2, style: '', tags: [] })).toBe('Renders (N): 2');
  });

  it('should return undefined without option fields or values', () => {
    expect(dbxLlmFlowSectionOptionsDescription(undefined, { count: 2 })).toBeUndefined();
    expect(dbxLlmFlowSectionOptionsDescription(FIELDS, undefined)).toBeUndefined();
  });
});

describe('history pruning', () => {
  const HISTORY_SECTIONS: Record<string, DbxLlmFlowSectionKey> = { b: 'brief', o: 'outline', d: 'draft' };

  // the section comes from the id's first letter: b(rief), o(utline), d(raft)
  function historyRun(id: string, startedAt: number, parentRunId?: string): DbxLlmFlowRun {
    return { id, sectionKey: HISTORY_SECTIONS[id[0]], kind: 'run', parentRunId, input: { rawInput: id }, state: 'success', startedAt: new Date(startedAt), finishedAt: new Date(startedAt + 1) };
  }

  function failed(run: DbxLlmFlowRun): DbxLlmFlowRun {
    return { ...run, state: 'failed' };
  }

  function historyState(runs: DbxLlmFlowRun[], sections?: Partial<Record<DbxLlmFlowSectionKey, Partial<DbxLlmFlowState['sections'][string]>>>): DbxLlmFlowState {
    const sectionStates: DbxLlmFlowState['sections'] = {};

    for (const key of ['brief', 'outline', 'draft']) {
      sectionStates[key] = { key, draft: { rawInput: '' }, selectedRunIds: [], draftRevision: 0, mountCount: 1, ...sections?.[key] };
    }

    return { ...initialDbxLlmFlowState(), sections: sectionStates, runs: Object.fromEntries(runs.map((x) => [x.id, x])) };
  }

  function kept(state: DbxLlmFlowState, maxRootRuns: number, maxLeafRuns: number): string[] {
    return Array.from(dbxLlmFlowHistoryRunIdsToKeep(state, { maxRootRuns, maxLeafRuns })).sort();
  }

  it('should default both limits to 25', () => {
    expect(dbxLlmFlowHistoryLimits(undefined)).toEqual({ maxRootRuns: 25, maxLeafRuns: 25 });
    expect(dbxLlmFlowHistoryLimits({ maxLeafRuns: 3 })).toEqual({ maxRootRuns: 25, maxLeafRuns: 3 });
  });

  it('should keep every root up to the limit with the path to its latest leaf, and prune the older leaves oldest first', () => {
    const runs: DbxLlmFlowRun[] = [];

    for (const i of [1, 2, 3]) {
      runs.push(historyRun(`b${i}`, i * 100), historyRun(`o${i}`, i * 100 + 10, `b${i}`), historyRun(`d${i}old`, i * 100 + 20, `o${i}`), historyRun(`d${i}new`, i * 100 + 30, `o${i}`));
    }

    expect(kept(historyState(runs), 3, 3)).toEqual(['b1', 'b2', 'b3', 'd1new', 'd2new', 'd3new', 'o1', 'o2', 'o3']);
  });

  it('should always keep the runs in use with their parents', () => {
    const runs = [historyRun('b1', 100), historyRun('o1', 110, 'b1'), historyRun('b2', 200), historyRun('b3', 300), failed(historyRun('bfailed', 400))];
    const state = historyState(runs, { outline: { selectedRunIds: ['o1'] }, brief: { lastFailedRunId: 'bfailed' } });
    expect(kept(state, 1, 1)).toEqual(['b1', 'bfailed', 'o1']);
  });

  it('should protect the latest successful leaf over a newer failed one', () => {
    const runs = [historyRun('b', 1), historyRun('o', 10, 'b'), historyRun('dok', 20, 'o'), failed(historyRun('dfailed', 30, 'o'))];
    expect(kept(historyState(runs), 3, 1)).toEqual(['b', 'dok', 'o']);
  });

  it('should return the same state when nothing is pruned, and keep the run order', () => {
    const state = historyState([historyRun('b2', 200), historyRun('b1', 100), historyRun('b3', 300)]);
    expect(dbxLlmFlowStateWithPrunedRuns(state, undefined)).toBe(state);

    const pruned = dbxLlmFlowStateWithPrunedRuns(state, { maxRootRuns: 2 });
    expect(Object.keys(pruned.runs)).toEqual(['b2', 'b3']);
  });

  it('should prune the history in memory when a run finishes', () => {
    const flow = makeFlow([FORM_A, TEXT_B], { history: { maxRootRuns: 2, maxLeafRuns: 2 } });
    run(flow, 'a', 'a1', 'one');
    run(flow, 'a', 'a2', 'two');
    run(flow, 'a', 'a3', 'three');

    expect(Object.keys(flow.state.runs)).toEqual(['a2', 'a3']);
  });
});

describe('dbxLlmFlowSectionStepNumber()', () => {
  function stepNumbers(flow: TestFlow, keys: DbxLlmFlowSectionKey[]): number[] {
    return keys.map((key) => dbxLlmFlowSectionStepNumber(flow.state, key, flow.context));
  }

  it('should number a chain without fixed numbers from 1', () => {
    const flow = makeFlow([{ key: 'a' }, { key: 'b', parentKey: 'a' }, { key: 'c', parentKey: 'b' }]);
    expect(stepNumbers(flow, ['a', 'b', 'c'])).toEqual([1, 2, 3]);
  });

  it('should number on from a root fixed at 0', () => {
    const flow = makeFlow([
      { key: 'a', stepNumber: 0 },
      { key: 'b', parentKey: 'a' },
      { key: 'c', parentKey: 'b' }
    ]);
    expect(stepNumbers(flow, ['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });

  it('should re-base the count from a fixed number in the middle of the chain', () => {
    const flow = makeFlow([{ key: 'a' }, { key: 'b', parentKey: 'a', stepNumber: 5 }, { key: 'c', parentKey: 'b' }]);
    expect(stepNumbers(flow, ['a', 'b', 'c'])).toEqual([1, 5, 6]);
  });

  it('should use the nearest fixed number when several are in the chain', () => {
    const flow = makeFlow([
      { key: 'a', stepNumber: 0 },
      { key: 'b', parentKey: 'a' },
      { key: 'c', parentKey: 'b', stepNumber: 10 },
      { key: 'd', parentKey: 'c' }
    ]);
    expect(stepNumbers(flow, ['a', 'b', 'c', 'd'])).toEqual([0, 1, 10, 11]);
  });

  it('should number separate roots independently', () => {
    const flow = makeFlow([{ key: 'setup', stepNumber: 0 }, { key: 'prompt' }, { key: 'layout', parentKey: 'prompt' }]);
    expect(stepNumbers(flow, ['setup', 'prompt', 'layout'])).toEqual([0, 1, 2]);
  });

  it('should use the config of an unregistered section, or 1', () => {
    const flow = makeFlow([{ key: 'a' }]);
    const configs: Record<DbxLlmFlowSectionKey, DbxLlmFlowAnySectionConfig> = { fixed: { key: 'fixed', stepNumber: 0 } };
    const context = { sectionConfig: (key: DbxLlmFlowSectionKey) => configs[key] };

    expect(dbxLlmFlowSectionStepNumber(flow.state, 'fixed', context)).toBe(0);
    expect(dbxLlmFlowSectionStepNumber(flow.state, 'unknown', context)).toBe(1);
  });
});

describe('view-only state', () => {
  interface SetupState {
    readonly hosted?: boolean;
    readonly look?: string;
  }

  const SETUP: DbxLlmFlowAnySectionConfig = { key: 'setup', viewOnly: true };
  const PROMPT: DbxLlmFlowAnySectionConfig = { key: 'prompt', parentKey: 'setup', hasForm: true, initialDraft: { formValue: { mood: 'calm' } }, requireParentRun: true };
  const RENDER: DbxLlmFlowAnySectionConfig = { key: 'render', parentKey: 'prompt' };
  const VALIDATED_SETUP: DbxLlmFlowAnySectionConfig = { ...SETUP, validateInput: (input) => ((input.formValue as Maybe<SetupState>)?.hosted ? undefined : 'Host the world.') };

  function setState(flow: TestFlow, key: DbxLlmFlowSectionKey, formValue: unknown) {
    flow.state = dbxLlmFlowStateWithFormValue(flow.state, { key, formValue }, flow.context);
  }

  function stateRun(flow: TestFlow, key: DbxLlmFlowSectionKey = 'setup'): Maybe<DbxLlmFlowRun> {
    const runId = flow.state.sections[key].selectedRunIds.at(-1);
    return runId == null ? undefined : flow.state.runs[runId];
  }

  function stateRunIds(flow: TestFlow): string[] {
    return Object.values(flow.state.runs)
      .filter(isDbxLlmFlowStateRun)
      .map((x) => x.id);
  }

  it('should not record a state run, or report an empty input, while the state is unset', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    expect(flow.state.sections['setup'].inputIssues).toBeUndefined();
    expect(flow.state.runs).toEqual({});
    expect(dbxLlmFlowSectionRunAvailability(flow.state, 'prompt', flow.context).blockedReason).toBe('parent_run_required');
  });

  it('should record the state as the selected state run, which the children follow', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    setState(flow, 'setup', { look: 'noir' });

    const run = stateRun(flow) as DbxLlmFlowRun;
    expect(run.kind).toBe(DBX_LLM_FLOW_STATE_RUN_KIND);
    expect(isDbxLlmFlowStateRun(run)).toBe(true);
    expect(run.state).toBe('success');
    expect(run.output).toEqual({ look: 'noir' });
    expect(run.input.formValue).toEqual({ look: 'noir' });
    expect(run.parentRunId).toBeUndefined();
    expect(flow.state.sections['prompt'].followedParentRunId).toBe(run.id);
    expect(dbxLlmFlowSectionRunAvailability(flow.state, 'prompt', flow.context).canRun).toBe(true);
  });

  it('should ignore a deep-equal state', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    setState(flow, 'setup', { look: 'noir' });
    const state = flow.state;
    setState(flow, 'setup', { look: 'noir' });
    expect(flow.state).toBe(state);
  });

  it('should record the initial state when the section registers', () => {
    const flow = makeFlow([{ ...SETUP, initialDraft: { formValue: { look: 'noir' } } }, PROMPT]);
    expect(stateRun(flow)?.output).toEqual({ look: 'noir' });
    expect(flow.state.sections['prompt'].followedParentRunId).toBe(stateRun(flow)?.id);
  });

  it('should record a state pushed by a bound form', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    flow.state = dbxLlmFlowStateWithDraftFormValue(flow.state, { key: 'setup', bindingId: 1, formValue: { look: 'noir' } }, flow.context);
    expect(flow.state.sections['setup'].draftSource).toBe(1);
    expect(stateRun(flow)?.output).toEqual({ look: 'noir' });
  });

  it('should hand the state to the runs below it through their parent run and lineage', () => {
    const flow = makeFlow([SETUP, PROMPT, RENDER]);
    setState(flow, 'setup', { look: 'noir' });
    const setupRunId = stateRun(flow)?.id;

    const promptStart = startRun(flow, 'prompt', 'p1');
    expect(promptStart.value?.parentRun?.output).toEqual({ look: 'noir' });
    completeRun(flow, 'p1', 'scene');
    expect(flow.state.runs['p1'].parentRunId).toBe(setupRunId);

    const renderStart = startRun(flow, 'render', 'r1');
    const lineage = renderStart.value?.lineage ?? [];
    expect(lineage.map((x) => x.sectionKey)).toEqual(['setup', 'prompt']);
    expect(dbxLlmFlowLineageRun<SetupState>(lineage, 'setup')?.output).toEqual({ look: 'noir' });
    expect(dbxLlmFlowLineageRun(lineage, 'unknown')).toBeUndefined();
  });

  it('should replace a state run nothing was made from, and keep one with runs below it', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    setState(flow, 'setup', { look: 'noir' });
    const noir = stateRun(flow)?.id as string;

    setState(flow, 'setup', { look: 'pastel' });
    const pastel = stateRun(flow)?.id as string;
    expect(pastel).not.toBe(noir);
    expect(stateRunIds(flow)).toEqual([pastel]);

    run(flow, 'prompt', 'p1', 'pastel scene');
    setState(flow, 'setup', { look: 'neon' });
    const neon = stateRun(flow)?.id as string;
    expect(stateRunIds(flow)).toEqual([pastel, neon]);
    expect(flow.state.sections['prompt'].followedParentRunId).toBe(neon);
    expect(flow.state.sections['prompt'].selectedRunIds).toEqual([]);
  });

  it('should reselect an earlier state and restore the latest runs made from it', () => {
    const flow = makeFlow([SETUP, PROMPT, RENDER]);
    setState(flow, 'setup', { look: 'noir' });
    const noir = stateRun(flow)?.id as string;
    run(flow, 'prompt', 'p1', 'noir scene');
    run(flow, 'render', 'r1', 'noir render');

    setState(flow, 'setup', { look: 'pastel' });
    expect(flow.state.sections['prompt'].selectedRunIds).toEqual([]);
    expect(flow.state.sections['render'].selectedRunIds).toEqual([]);
    expect(flow.state.sections['render'].followedParentRunId).toBeUndefined();

    setState(flow, 'setup', { look: 'noir' });
    expect(stateRun(flow)?.id).toBe(noir);
    expect(flow.state.sections['prompt'].selectedRunIds).toEqual(['p1']);
    expect(flow.state.sections['render'].selectedRunIds).toEqual(['r1']);
    expect(stateRunIds(flow)).toEqual([noir]); // the pastel state run had nothing below it
  });

  it('should restore the state a child ran with when the child run is loaded with its parents', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    setState(flow, 'setup', { look: 'noir' });
    run(flow, 'prompt', 'p1', 'noir scene');
    setState(flow, 'setup', { look: 'pastel' });
    run(flow, 'prompt', 'p2', 'pastel scene');

    const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'p1', withAncestors: true }, flow.context);
    expect(loaded.loaded).toBe(true);
    expect(loaded.state.sections['setup'].draft.formValue).toEqual({ look: 'noir' });
    expect(loaded.state.sections['setup'].selectedRunIds).toEqual([flow.state.runs['p1'].parentRunId]);
    expect(loaded.state.sections['prompt'].selectedRunIds).toEqual(['p1']);
  });

  it('should select nothing and clear the children while the state is invalid, then restore them', () => {
    const flow = makeFlow([VALIDATED_SETUP, PROMPT, RENDER]);
    setState(flow, 'setup', { hosted: false, look: 'noir' });
    expect(flow.state.sections['setup'].inputIssues).toEqual(['Host the world.']);
    expect(stateRun(flow)).toBeUndefined();

    setState(flow, 'setup', { hosted: true, look: 'noir' });
    run(flow, 'prompt', 'p1', 'noir scene');
    run(flow, 'render', 'r1', 'noir render');

    setState(flow, 'setup', { hosted: false, look: 'noir' });
    expect(flow.state.sections['setup'].selectedRunIds).toEqual([]);
    expect(flow.state.sections['prompt'].followedParentRunId).toBeUndefined();
    expect(flow.state.sections['prompt'].selectedRunIds).toEqual([]);
    expect(flow.state.sections['render'].selectedRunIds).toEqual([]);
    expect(dbxLlmFlowSectionRunAvailability(flow.state, 'prompt', flow.context).blockedReason).toBe('parent_run_required');

    setState(flow, 'setup', { hosted: true, look: 'noir' });
    expect(flow.state.sections['prompt'].selectedRunIds).toEqual(['p1']);
    expect(flow.state.sections['render'].selectedRunIds).toEqual(['r1']);
  });

  it('should not record the state while its bound form is invalid', () => {
    const flow = makeFlow([SETUP, PROMPT]);
    flow.state = dbxLlmFlowStateWithFormValid(flow.state, { key: 'setup', valid: false }, flow.context);
    setState(flow, 'setup', { look: 'noir' });
    expect(stateRun(flow)).toBeUndefined();

    flow.state = dbxLlmFlowStateWithFormValid(flow.state, { key: 'setup', valid: true }, flow.context);
    expect(stateRun(flow)?.output).toEqual({ look: 'noir' });
  });

  it('should not auto-run a child when the state changes', () => {
    const flow = makeFlow([SETUP, { ...PROMPT, autoRunAfterParent: true }]);
    flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'prompt', kind: 'run', mounted: true });
    setState(flow, 'setup', { look: 'noir' });
    expect(flow.state.sections['prompt'].followedParentRunId).toBe(stateRun(flow)?.id);
    expect(flow.state.runRequests['prompt']).toBeUndefined();
  });

  describe('below a run section', () => {
    const SETTINGS: DbxLlmFlowAnySectionConfig = { key: 'settings', parentKey: 'a', viewOnly: true };

    it('should record the state under the followed parent run only, and auto-run on from a completed parent run', () => {
      const flow = makeFlow([FORM_A, { ...SETTINGS, initialDraft: { formValue: { size: 1 } } }, { key: 'draft', parentKey: 'settings', autoRunAfterParent: true }]);
      flow.state = dbxLlmFlowStateWithRunBridge(flow.state, { key: 'draft', kind: 'run', mounted: true });
      expect(stateRun(flow, 'settings')).toBeUndefined(); // follows no parent run yet

      run(flow, 'a', 'a1', 'outline');
      const settingsRun = stateRun(flow, 'settings');
      expect(settingsRun?.parentRunId).toBe('a1');
      expect(settingsRun?.output).toEqual({ size: 1 });
      expect(flow.state.sections['draft'].followedParentRunId).toBe(settingsRun?.id);
      expect(flow.state.runRequests['draft']?.kind).toBe('run');
    });

    it('should carry the state to a new parent run, and restore it when an earlier parent run is loaded', () => {
      const flow = makeFlow([FORM_A, SETTINGS]);
      run(flow, 'a', 'a1', 'x');
      setState(flow, 'settings', { size: 1 });
      run(flow, 'a', 'a2', 'y');
      expect(stateRun(flow, 'settings')?.parentRunId).toBe('a2');
      expect(stateRun(flow, 'settings')?.output).toEqual({ size: 1 });

      setState(flow, 'settings', { size: 2 });
      const loaded = dbxLlmFlowStateWithLoadedRun(flow.state, { runId: 'a1' }, flow.context);
      expect(loaded.state.sections['settings'].draft.formValue).toEqual({ size: 1 });
    });
  });
});
