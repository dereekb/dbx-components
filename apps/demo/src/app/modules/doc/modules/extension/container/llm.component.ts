import { Component, computed, signal, viewChild } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxButtonComponent, DbxContentContainerDirective, DbxContentPitDirective, DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import { type DbxLlmFlowConfig, DbxLlmFlowComponent, DbxLlmFlowDirective, type DbxLlmFlowRun, type DbxLlmFlowRunId, DbxLlmFlowSectionComponent, type DbxLlmFlowSectionConfig, type DbxLlmFlowState, defaultDbxLlmFlowToRawInput } from '@dereekb/dbx-form/llm';
import { type Maybe } from '@dereekb/util';
import { map, of, switchMap } from 'rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import {
  DOC_EXTENSION_LLM_BRIEF_TOPIC_MAX_LENGTH,
  DocExtensionLlmBriefFormComponent,
  type DocExtensionLlmBriefFormValue,
  docExtensionLlmFakeHandler,
  DocExtensionLlmMoodInputComponent,
  type DocExtensionLlmMoodValue,
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

export const DOC_EXTENSION_LLM_BRIEF_SECTION: DbxLlmFlowSectionConfig<DocExtensionLlmBriefFormValue, string> = {
  key: 'brief',
  label: 'Brief',
  hint: 'A forge form with a two-way JSON raw input: paste JSON into the raw input to fill the form, or anything else to override it.',
  formComponent: DocExtensionLlmBriefFormComponent,
  initialDraft: { formValue: { topic: 'Tide pools', tone: 'casual', paragraphs: 3 } },
  validateInput: (input) => validateBriefInput(input.formValue),
  formPopout: { mode: 'detach' },
  kinds: [
    {
      kind: 'plan',
      text: 'Outline',
      icon: 'format_list_numbered',
      handler: docExtensionLlmFakeHandler((value) => {
        const formValue = value.input.formValue;
        const paragraphs = Math.max(1, Math.min(6, formValue?.paragraphs ?? 3));
        const topic = briefTopic(formValue);
        return Array.from({ length: paragraphs }, (_, i) => `${i + 1}. ${topic}: point ${i + 1} (${formValue?.tone ?? 'casual'})`).join('\n');
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
    return { title: briefTopic(formValue), detail: `${run.kind === 'plan' ? 'Outline' : 'Quick draft'} · ${formValue?.tone ?? 'casual'}` };
  }
};

export const DOC_EXTENSION_LLM_OUTLINE_SECTION: DbxLlmFlowSectionConfig<unknown, string> = {
  key: 'outline',
  parentKey: 'brief',
  label: 'Outline',
  hint: 'No form: the Outline run text becomes this editable raw input. Follows only the "Outline" run kind, so a quick draft does not cascade here.',
  followParentKinds: ['plan'],
  rawInput: { mode: 'editable', minRows: 4 },
  kinds: [
    {
      kind: 'run',
      text: 'Expand',
      icon: 'edit_note',
      handler: docExtensionLlmFakeHandler((value) =>
        value.input.rawInput
          .split('\n')
          .filter((x) => x.trim())
          .map((x) => `${x.replace(/^\d+\.\s*/, '')}. This paragraph expands the point with supporting detail.`)
          .join('\n\n')
      )
    }
  ]
};

export const DOC_EXTENSION_LLM_DRAFT_SECTION: DbxLlmFlowSectionConfig<unknown, string> = {
  key: 'draft',
  parentKey: 'outline',
  label: 'Draft',
  hint: 'Read-only raw input from the expanded outline. With auto-run on, a successful Expand runs Polish automatically.',
  rawInput: { mode: 'readonly' },
  kinds: [{ kind: 'run', text: 'Polish', icon: 'auto_fix_high', handler: docExtensionLlmFakeHandler((value) => `${value.input.rawInput}\n\n(polished)`) }]
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
    { kind: 'llm', text: 'Compose · billed', icon: 'payments', handler: docExtensionLlmFakeHandler((value) => `A ${(value.input.formValue?.moods ?? []).join(', ')} scene, composed by the LLM.`) },
    { kind: 'floor', text: 'Compose floor · free', icon: 'memory', buttonStyle: { type: 'stroked' }, handler: docExtensionLlmFakeHandler((value) => `A ${(value.input.formValue?.moods ?? []).join(' and ')} scene.`) }
  ]
};

export const DOC_EXTENSION_LLM_RENDER_SECTION: DbxLlmFlowSectionConfig<unknown, DocExtensionLlmTakesOutput> = {
  key: 'render',
  parentKey: 'prompt',
  label: 'Render',
  rawInput: { mode: 'readonly', minRows: 2 },
  outputComponent: DocExtensionLlmTakesOutputComponent,
  kinds: [
    {
      kind: 'render',
      text: 'Render 2',
      icon: 'image',
      handler: docExtensionLlmFakeHandler((value) => ({ takes: [1, 2].map((i) => ({ id: `${value.runId}-take-${i}`, caption: `Take ${i} of "${value.input.rawInput}"` })) }))
    }
  ]
};

export type DocExtensionLlmWorld = 'north' | 'south';

@Component({
  templateUrl: './llm.component.html',
  imports: [DbxContentContainerDirective, DbxContentPitDirective, DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxLlmFlowComponent, DbxLlmFlowDirective, DbxLlmFlowSectionComponent, JsonPipe]
})
export class DocExtensionLlmComponent {
  readonly chainFlow = viewChild(DbxLlmFlowComponent);
  readonly labFlow = viewChild('labFlow', { read: DbxLlmFlowDirective });

  // MARK: Chain
  readonly autoRunDraftSignal = signal(true);

  readonly chainConfigSignal = computed<DbxLlmFlowConfig>(() => {
    const autoRunAfterParent = this.autoRunDraftSignal();
    return {
      persistence: { storageKey: 'doc-extension-llm-chain' },
      sections: [DOC_EXTENSION_LLM_BRIEF_SECTION, DOC_EXTENSION_LLM_OUTLINE_SECTION, { ...DOC_EXTENSION_LLM_DRAFT_SECTION, autoRunAfterParent }]
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

  // MARK: State
  readonly chainStateSignal = toSignal(toObservable(this.chainFlow).pipe(switchMap((flow) => (flow ? flow.flowDirective.store.state$.pipe(map((state) => ({ runTree: docExtensionLlmRunTree(state), state }))) : of(null)))));

  toggleAutoRunDraft(): void {
    this.autoRunDraftSignal.update((x) => !x);
  }

  toggleExclusiveRuns(): void {
    this.exclusiveRunsSignal.update((x) => !x);
  }

  selectWorld(world: DocExtensionLlmWorld): void {
    this.worldSignal.set(world);
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
