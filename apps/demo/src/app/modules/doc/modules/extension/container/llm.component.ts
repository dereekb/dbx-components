import { Component, computed, signal, viewChild } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { dbxForgeNumberField } from '@dereekb/dbx-form';
import { DbxButtonComponent, DbxButtonSpacerDirective, DbxContentContainerDirective, DbxContentPitDirective, DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import {
  type DbxLlmFlowConfig,
  DbxLlmFlowComponent,
  DbxLlmFlowDirective,
  type DbxLlmFlowRun,
  type DbxLlmFlowRunId,
  DbxLlmFlowSectionComponent,
  type DbxLlmFlowSectionConfig,
  type DbxLlmFlowSectionStatusChip,
  DbxLlmFlowSectionValueDirective,
  type DbxLlmFlowState,
  dbxLlmFlowLineageRun,
  defaultDbxLlmFlowToRawInput
} from '@dereekb/dbx-form/llm';
import { type Maybe } from '@dereekb/util';
import { map, of, switchMap } from 'rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import {
  DOC_EXTENSION_LLM_BRIEF_TOPIC_MAX_LENGTH,
  DOC_EXTENSION_LLM_DRAFT_MAX_RENDER_COUNT,
  DOC_EXTENSION_LLM_DRAFT_MIN_RENDER_COUNT,
  DocExtensionLlmBriefFormComponent,
  type DocExtensionLlmBriefFormValue,
  type DocExtensionLlmBriefTone,
  docExtensionLlmFakeHandler,
  DocExtensionLlmMoodInputComponent,
  type DocExtensionLlmMoodValue,
  docExtensionLlmDraftRenderCount,
  type DocExtensionLlmDraftValue,
  type DocExtensionLlmSwatchOutput,
  DocExtensionLlmSwatchesOutputComponent,
  docExtensionLlmSwatchColor,
  type DocExtensionLlmTakesOutput,
  DocExtensionLlmTakesOutputComponent
} from '../component/llm.example.component';

// MARK: Run Tree
/**
 * A node of the derived run tree shown in the store state example.
 */
export interface DocExtensionLlmRunTreeNode {
  readonly id: DbxLlmFlowRunId;
  readonly section: string;
  readonly kind: string;
  readonly state: string;
  readonly children: DocExtensionLlmRunTreeNode[];
}

/**
 * Derives the run tree (runs nested under their parent run) from the flow state.
 *
 * @param state - The flow state.
 * @returns The root nodes.
 */
export function docExtensionLlmRunTree(state: DbxLlmFlowState): DocExtensionLlmRunTreeNode[] {
  const childrenByParent = new Map<Maybe<DbxLlmFlowRunId>, DbxLlmFlowRun[]>();

  Object.values(state.runs).forEach((run) => {
    const parentRunId = run.parentRunId != null && state.runs[run.parentRunId] != null ? run.parentRunId : undefined;
    const siblings = childrenByParent.get(parentRunId) ?? [];
    siblings.push(run);
    childrenByParent.set(parentRunId, siblings);
  });

  const build = (parentRunId: Maybe<DbxLlmFlowRunId>): DocExtensionLlmRunTreeNode[] => (childrenByParent.get(parentRunId) ?? []).map((run) => ({ id: run.id, section: run.sectionKey, kind: run.kind, state: run.state, children: build(run.id) }));
  return build(undefined);
}

// MARK: Chain Configs
function briefTopic(value: Maybe<DocExtensionLlmBriefFormValue>): string {
  return value?.topic?.trim() || 'Untitled';
}

function validateBriefInput(value: Maybe<DocExtensionLlmBriefFormValue>): Maybe<string> {
  const topic = value?.topic?.trim();
  let message: Maybe<string>;

  if (!topic) {
    message = 'A topic is required.';
  } else if (topic.length > DOC_EXTENSION_LLM_BRIEF_TOPIC_MAX_LENGTH) {
    message = `The topic must be at most ${DOC_EXTENSION_LLM_BRIEF_TOPIC_MAX_LENGTH} characters.`;
  }

  return message;
}

// MARK: Outline JSON
/**
 * JSON outline returned by the Brief's "Outline" run. It is the editable input of the Outline section.
 */
export interface DocExtensionLlmOutline {
  readonly topic: string;
  readonly tone: DocExtensionLlmBriefTone;
  readonly points: readonly string[];
}

/**
 * Parses the Outline section's raw input. Throws when the text is not JSON with a "points" array of strings.
 *
 * @param rawInput - The raw input.
 * @returns The outline.
 */
export function parseDocExtensionLlmOutline(rawInput: string): DocExtensionLlmOutline {
  const parsed = JSON.parse(rawInput) as Maybe<Partial<DocExtensionLlmOutline>>;

  if (!Array.isArray(parsed?.points) || !parsed.points.every((x) => typeof x === 'string')) {
    throw new Error('"points" must be an array of strings.');
  }

  return parsed as DocExtensionLlmOutline;
}

function validateOutlineInput(rawInput: string): Maybe<string> {
  let message: Maybe<string>;

  if (rawInput.trim()) {
    try {
      parseDocExtensionLlmOutline(rawInput);
    } catch (e) {
      message = `The outline is not valid: ${(e as Error).message}`;
    }
  }

  return message;
}

export const DOC_EXTENSION_LLM_BRIEF_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmBriefFormValue, DocExtensionLlmOutline | string> = {
  key: 'brief',
  label: 'Brief',
  hint: 'A forge form with a two-way JSON raw input: type or paste JSON into the raw input to fill the form. Text that is not valid JSON overrides the form until it parses.',
  formComponent: DocExtensionLlmBriefFormComponent,
  initialDraft: { formValue: { topic: 'Tide pools', tone: 'casual', paragraphs: 3 } },
  validateInput: (input) => validateBriefInput(input.formValue),
  formPopout: { mode: 'detach' },
  kinds: [
    {
      kind: 'plan',
      text: 'Outline',
      handler: docExtensionLlmFakeHandler((value) => {
        const formValue = value.input.formValue;
        const paragraphs = Math.max(1, Math.min(6, formValue?.paragraphs ?? 3));
        const topic = briefTopic(formValue);
        const outline: DocExtensionLlmOutline = { topic, tone: formValue?.tone ?? 'casual', points: Array.from({ length: paragraphs }, (_, i) => `${topic}: point ${i + 1}`) };
        return outline;
      })
    },
    {
      kind: 'render',
      text: 'Quick draft',
      icon: 'bolt',
      buttonStyle: { type: 'stroked', color: 'primary' },
      handler: docExtensionLlmFakeHandler((value) => `A quick ${value.input.formValue?.tone ?? 'casual'} draft about ${briefTopic(value.input.formValue)}.`)
    }
  ],
  describeRun: (run) => {
    const formValue = run.input.formValue as Maybe<DocExtensionLlmBriefFormValue>;
    return { title: briefTopic(formValue), detail: `${formValue?.tone ?? 'casual'} · ${formValue?.paragraphs ?? 3} paragraphs` };
  }
};

export const DOC_EXTENSION_LLM_OUTLINE_SECTION: DbxLlmFlowSectionConfig<unknown, string> = {
  key: 'outline',
  parentKey: 'brief',
  label: 'Outline',
  hint: 'No form: the JSON outline from the Brief\'s "Outline" run becomes this editable input (fromParentOutput). Edit the JSON directly: validateInput shows an error and blocks Expand until it is JSON with a "points" array. Follows only the "Outline" run kind, so a quick draft does not cascade here.',
  followParentKinds: ['plan'],
  rawInput: { mode: 'editable', rows: 8, label: 'Outline JSON' },
  fromParentOutput: ({ parentOutput }) => ({ rawInput: defaultDbxLlmFlowToRawInput(parentOutput) }),
  validateInput: (input) => validateOutlineInput(input.rawInput),
  kinds: [
    {
      kind: 'run',
      text: 'Expand',
      handler: docExtensionLlmFakeHandler((value) => {
        const outline = parseDocExtensionLlmOutline(value.input.rawInput);
        return outline.points.map((point) => `${point}. This ${outline.tone} paragraph expands the point with supporting detail.`).join('\n\n');
      })
    }
  ]
};

export const DOC_EXTENSION_LLM_DRAFT_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmDraftValue, DocExtensionLlmSwatchOutput> = {
  key: 'draft',
  parentKey: 'outline',
  label: 'Draft',
  hint: 'Options and a custom, non-text output. The read-only raw input is the expanded outline, and the render count (N) is an option field (optionFields) in the same forge form, under the input, so Render stretches to cover both. Each run keeps its options: the history lists them and picking a run restores them. Each Render makes N images, and the outputComponent shows every render in a dbx-gallery, newest first. With auto-run on, a successful Expand renders automatically.',
  optionFields: [
    dbxForgeNumberField({
      key: 'count',
      label: 'Renders (N)',
      hint: 'Each Render makes N images.',
      min: DOC_EXTENSION_LLM_DRAFT_MIN_RENDER_COUNT,
      max: DOC_EXTENSION_LLM_DRAFT_MAX_RENDER_COUNT,
      step: 1,
      enforceStep: true
    })
  ],
  initialDraft: { formValue: { count: 1 } },
  rawInput: { mode: 'readonly' },
  outputComponent: DocExtensionLlmSwatchesOutputComponent,
  kinds: [
    {
      kind: 'run',
      text: 'Render',
      handler: docExtensionLlmFakeHandler((value) => ({ colors: Array.from({ length: docExtensionLlmDraftRenderCount(value.input.formValue?.count) }, (_, i) => docExtensionLlmSwatchColor(`${value.runId}_${i}`)) }))
    }
  ]
};

// MARK: Lab Configs
export const DOC_EXTENSION_LLM_PROMPT_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmMoodValue, string> = {
  key: 'prompt',
  label: 'Prompt',
  formComponent: DocExtensionLlmMoodInputComponent,
  initialDraft: { formValue: { moods: ['calm'] } },
  validateInput: (input) => (input.formValue?.moods?.length ? undefined : 'Pick at least one mood.'),
  formPopout: false,
  kinds: [
    { kind: 'llm', text: 'Compose · billed', handler: docExtensionLlmFakeHandler((value) => `A ${(value.input.formValue?.moods ?? []).join(', ')} scene, composed by the LLM.`) },
    { kind: 'floor', text: 'Compose floor · free', buttonStyle: { type: 'stroked' }, handler: docExtensionLlmFakeHandler((value) => `A ${(value.input.formValue?.moods ?? []).join(' and ')} scene.`) }
  ]
};

export const DOC_EXTENSION_LLM_RENDER_SECTION: DbxLlmFlowSectionConfig<unknown, DocExtensionLlmTakesOutput> = {
  key: 'render',
  parentKey: 'prompt',
  label: 'Render',
  rawInput: { mode: 'readonly', rows: 2 },
  outputComponent: DocExtensionLlmTakesOutputComponent,
  kinds: [
    {
      kind: 'render',
      text: 'Render 2',
      handler: docExtensionLlmFakeHandler((value) => ({ takes: [1, 2].map((i) => ({ id: `${value.runId}-take-${i}`, caption: `Take ${i} of "${value.input.rawInput}"` })) }))
    }
  ]
};

// MARK: View-only Configs
export type DocExtensionLlmLook = 'noir' | 'pastel';

/**
 * State of the view-only Setup section. JSON-compatible: it is recorded in the run tree.
 */
export interface DocExtensionLlmSetupState {
  readonly hosted?: boolean;
  readonly look?: Maybe<DocExtensionLlmLook>;
}

/**
 * Returns the messages that keep the setup from being recorded, or undefined once it is ready.
 *
 * @param state - The setup state.
 * @returns The messages, if any.
 */
export function docExtensionLlmSetupIssues(state: Maybe<DocExtensionLlmSetupState>): Maybe<string[]> {
  const issues: string[] = [];

  if (!state?.hosted) {
    issues.push('Host the world.');
  }

  if (!state?.look) {
    issues.push('Pick a Look.');
  }

  return issues.length ? issues : undefined;
}

/**
 * A view-only setup step numbered 0: a bench with no runs whose state (hosted, Look) is recorded in the run tree. The Scene step below
 * requires it, and each scene carries the setup it was composed with.
 */
export const DOC_EXTENSION_LLM_SETUP_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmSetupState> = {
  key: 'setup',
  label: 'Setup',
  hint: "Host the world and pick a Look. The setup is this step's state: it is recorded in the run tree, so every scene below carries it. It collapses itself once ready.",
  viewOnly: true,
  stepNumber: 0,
  initialDraft: { formValue: { hosted: false } },
  validateInput: (input) => docExtensionLlmSetupIssues(input.formValue)
};

/**
 * The Scene step below the setup. It can't run until the setup is ready, and its handler reads the setup from the run's lineage.
 */
export const DOC_EXTENSION_LLM_SCENE_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmMoodValue, string> = {
  key: 'scene',
  parentKey: 'setup',
  label: 'Scene',
  hint: 'Compose a scene, switch the Look, then compose again. Load the first scene with its parents (the tree button in the history) and the setup switches back. Switching the Look back to one with scenes restores its latest scene.',
  formComponent: DocExtensionLlmMoodInputComponent,
  initialDraft: { formValue: { moods: ['calm'] } },
  validateInput: (input) => (input.formValue?.moods?.length ? undefined : 'Pick at least one mood.'),
  requireParentRun: true,
  formPopout: false,
  kinds: [
    {
      kind: 'run',
      text: 'Compose',
      handler: docExtensionLlmFakeHandler((value) => {
        const setup = dbxLlmFlowLineageRun<DocExtensionLlmSetupState>(value.lineage, 'setup')?.output;
        return `A ${(value.input.formValue?.moods ?? []).join(', ')} scene in the ${setup?.look ?? 'plain'} Look.`;
      })
    }
  ],
  describeRun: (run) => ({ title: String(run.output ?? run.id) })
};

export type DocExtensionLlmWorld = 'north' | 'south';

@Component({
  templateUrl: './llm.component.html',
  imports: [
    DbxContentContainerDirective,
    DbxContentPitDirective,
    DbxButtonComponent,
    DbxButtonSpacerDirective,
    DbxFlexGroupDirective,
    DbxFlexSizeDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DbxLlmFlowComponent,
    DbxLlmFlowDirective,
    DbxLlmFlowSectionComponent,
    DbxLlmFlowSectionValueDirective,
    JsonPipe
  ]
})
export class DocExtensionLlmComponent {
  readonly chainFlow = viewChild(DbxLlmFlowComponent);
  readonly labFlow = viewChild('labFlow', { read: DbxLlmFlowDirective });
  readonly viewOnlyFlow = viewChild('viewOnlyFlow', { read: DbxLlmFlowDirective });

  // MARK: Step Numbers
  /**
   * Whether the sections of both examples show their step number in the chain. The chain passes it through each section config's display, the
   * lab through each section's display input.
   */
  readonly stepNumberSignal = signal(true);

  // MARK: Chain
  readonly autoRunDraftSignal = signal(true);

  readonly chainConfigSignal = computed<DbxLlmFlowConfig>(() => {
    const autoRunAfterParent = this.autoRunDraftSignal();
    const stepNumber = this.stepNumberSignal();
    const sections = [DOC_EXTENSION_LLM_BRIEF_SECTION, DOC_EXTENSION_LLM_OUTLINE_SECTION, { ...DOC_EXTENSION_LLM_DRAFT_SECTION, autoRunAfterParent }].map((section) => ({ ...section, display: { ...section.display, stepNumber } }));
    return {
      persistence: { storageKey: 'doc-extension-llm-chain-v3' },
      sections
    };
  });

  // MARK: Lab
  readonly promptConfig = DOC_EXTENSION_LLM_PROMPT_SECTION;
  readonly renderConfig = DOC_EXTENSION_LLM_RENDER_SECTION;
  readonly worlds: DocExtensionLlmWorld[] = ['north', 'south'];

  readonly exclusiveRunsSignal = signal(true);
  readonly worldSignal = signal<DocExtensionLlmWorld>('north');

  readonly labConfigSignal = computed<DbxLlmFlowConfig>(() => {
    const exclusiveRuns = this.exclusiveRunsSignal();
    return { exclusiveRuns };
  });

  readonly labStorageKeySignal = computed(() => `doc-extension-llm-lab-${this.worldSignal()}`);

  // MARK: View-only
  readonly setupConfig = DOC_EXTENSION_LLM_SETUP_SECTION;
  readonly sceneConfig = DOC_EXTENSION_LLM_SCENE_SECTION;
  readonly looks: DocExtensionLlmLook[] = ['noir', 'pastel'];

  /**
   * The setup state, bound two-way to the Setup section with dbxLlmFlowSectionValue. Loading a scene with its parents, or restoring the flow,
   * writes the setup it was composed with back here.
   */
  readonly setupStateSignal = signal<Maybe<DocExtensionLlmSetupState>>(undefined);

  readonly setupHostedSignal = computed(() => this.setupStateSignal()?.hosted === true);
  readonly setupLookSignal = computed(() => this.setupStateSignal()?.look);
  readonly setupReadySignal = computed(() => docExtensionLlmSetupIssues(this.setupStateSignal()) == null);

  readonly setupStatusChipSignal = computed<DbxLlmFlowSectionStatusChip>(() => {
    const ready = this.setupReadySignal();
    const hosted = this.setupHostedSignal();
    const look = this.setupLookSignal();
    let chip: DbxLlmFlowSectionStatusChip;

    if (ready) {
      chip = { text: `${look} · configured`, color: 'ok' };
    } else if (hosted) {
      chip = { text: 'needs a Look', color: 'warn' };
    } else {
      chip = { text: 'not hosted', color: 'warn' };
    }

    return chip;
  });

  // MARK: State
  readonly chainStateSignal = toSignal(toObservable(this.chainFlow).pipe(switchMap((flow) => (flow ? flow.flowDirective.store.state$.pipe(map((state) => ({ runTree: docExtensionLlmRunTree(state), state }))) : of(null)))));

  toggleStepNumber(): void {
    this.stepNumberSignal.update((x) => !x);
  }

  toggleAutoRunDraft(): void {
    this.autoRunDraftSignal.update((x) => !x);
  }

  toggleExclusiveRuns(): void {
    this.exclusiveRunsSignal.update((x) => !x);
  }

  selectWorld(world: DocExtensionLlmWorld): void {
    this.worldSignal.set(world);
  }

  toggleSetupHosted(): void {
    this._updateSetup((state) => ({ ...state, hosted: !state?.hosted }));
  }

  selectSetupLook(look: DocExtensionLlmLook): void {
    this._updateSetup((state) => ({ ...state, look: state?.look === look ? undefined : look }));
  }

  /**
   * Applies a setup change, then collapses the setup section once it becomes ready, or expands it when it no longer is. Only a change of
   * readiness moves it, so the user's own toggle sticks.
   *
   * @param change - Returns the changed setup state.
   */
  private _updateSetup(change: (state: Maybe<DocExtensionLlmSetupState>) => DocExtensionLlmSetupState): void {
    const wasReady = this.setupReadySignal();
    this.setupStateSignal.update(change);
    const ready = this.setupReadySignal();

    if (ready !== wasReady) {
      this.viewOnlyFlow()?.store.setCollapsed(DOC_EXTENSION_LLM_SETUP_SECTION.key, ready);
    }
  }

  importLabHistory(): void {
    const store = this.labFlow()?.store;

    if (store != null) {
      const world = this.worldSignal();
      const now = Date.now();
      const composeId = `server-${world}-compose`;
      const composeOutput = `A misty ${world} harbor at dawn (imported from the server).`;
      const moods: DocExtensionLlmMoodValue = { moods: ['calm', 'moody'] };
      const runs: DbxLlmFlowRun[] = [
        { id: composeId, sectionKey: 'prompt', kind: 'llm', input: { formValue: moods, rawInput: defaultDbxLlmFlowToRawInput(moods) }, state: 'success', output: composeOutput, startedAt: new Date(now - 7200000), finishedAt: new Date(now - 7190000), imported: true, data: { serverKey: composeId, cost: 0.02 } },
        {
          id: `server-${world}-render`,
          sectionKey: 'render',
          kind: 'render',
          parentRunId: composeId,
          input: { rawInput: composeOutput },
          state: 'success',
          output: { takes: [{ id: `server-${world}-take-1`, caption: 'Imported take' }] },
          startedAt: new Date(now - 7100000),
          finishedAt: new Date(now - 7000000),
          imported: true
        }
      ];

      store.importRuns({ runs, duplicates: 'skip', selectLatest: true });
    }
  }
}
