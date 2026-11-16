import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgeNumberField, dbxForgeTextAreaField, dbxForgeTextField, dbxForgeValueSelectionField } from '@dereekb/dbx-form';
import { DbxLlmFlowSectionFormBindingTarget, type DbxLlmFlowRunValue, DbxLlmFlowSectionStore } from '@dereekb/dbx-form/llm';
import { cleanSubscription } from '@dereekb/dbx-core';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { type Work } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { delay, type Observable, of, switchMap, throwError, timer } from 'rxjs';

// MARK: Fake Handlers
/**
 * Delay of every fake demo run.
 */
export const DOC_EXTENSION_LLM_FAKE_RUN_DELAY = 800;

/**
 * Creates a fake run handler. An input containing "fail" fails the run, and an input containing "date" returns a Date to show the non-JSON
 * output error. Otherwise it returns produce(value) after a short delay.
 *
 * @param produce - Produces the output.
 * @returns The handler.
 */
export function docExtensionLlmFakeHandler<F, O>(produce: (value: DbxLlmFlowRunValue<F, O>) => O): Work<DbxLlmFlowRunValue<F, O>, O> {
  return (value: DbxLlmFlowRunValue<F, O>): Observable<O> => {
    const text = value.input.rawInput.toLowerCase();
    let result: Observable<O>;

    if (text.includes('fail')) {
      result = timer(DOC_EXTENSION_LLM_FAKE_RUN_DELAY).pipe(switchMap(() => throwError(() => ({ code: 'DEMO_RUN_FAILED', message: 'The demo run failed because the input contains "fail".' }))));
    } else if (text.includes('date')) {
      result = of(new Date() as unknown as O).pipe(delay(DOC_EXTENSION_LLM_FAKE_RUN_DELAY));
    } else {
      result = of(produce(value)).pipe(delay(DOC_EXTENSION_LLM_FAKE_RUN_DELAY));
    }

    return result;
  };
}

// MARK: Brief Form
export type DocExtensionLlmBriefTone = 'casual' | 'formal' | 'playful';

/**
 * JSON-safe value of the brief form.
 */
export interface DocExtensionLlmBriefFormValue {
  readonly topic?: string;
  readonly tone?: DocExtensionLlmBriefTone;
  readonly paragraphs?: number;
  readonly notes?: string;
}

/**
 * Max length of the brief topic, checked by the section's validateInput.
 */
export const DOC_EXTENSION_LLM_BRIEF_TOPIC_MAX_LENGTH = 80;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-extension-llm-brief-form',
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule]
})
export class DocExtensionLlmBriefFormComponent extends AbstractSyncForgeFormDirective<DocExtensionLlmBriefFormValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeTextField({ key: 'topic', label: 'Topic', hint: 'What to write about. Include "fail" or "date" to see a failed run or the non-JSON output error.' }),
      dbxForgeValueSelectionField({
        key: 'tone',
        label: 'Tone',
        props: {
          options: [
            { label: 'Casual', value: 'casual' },
            { label: 'Formal', value: 'formal' },
            { label: 'Playful', value: 'playful' }
          ]
        }
      }),
      dbxForgeNumberField({ key: 'paragraphs', label: 'Paragraphs', min: 1, max: 6 }),
      dbxForgeTextAreaField({ key: 'notes', label: 'Notes', rows: 2 })
    ]
  } as FormConfig;
}

// MARK: Mood Input
/**
 * JSON-safe value of the custom mood input.
 */
export interface DocExtensionLlmMoodValue {
  readonly moods?: readonly string[];
}

export const DOC_EXTENSION_LLM_MOODS = ['calm', 'tense', 'bright', 'moody', 'epic'];

/**
 * A custom, non-forge input that binds to its section through the public DbxLlmFlowSectionFormBindingTarget contract.
 */
@Component({
  selector: 'doc-extension-llm-mood-input',
  template: `
    <div class="dbx-label dbx-small">Moods (a custom input on the binding contract)</div>
    <div class="dbx-flex-bar">
      @for (mood of moods; track mood) {
        <dbx-button [text]="mood" [disabled]="lockedSignal()" [buttonStyle]="selectedMoodsSignal().has(mood) ? selectedStyle : unselectedStyle" (buttonClick)="toggleMood(mood)"></dbx-button>
      }
    </div>
  `,
  imports: [DbxButtonComponent]
})
export class DocExtensionLlmMoodInputComponent {
  readonly target = inject(DbxLlmFlowSectionFormBindingTarget<DocExtensionLlmMoodValue>);

  readonly moods = DOC_EXTENSION_LLM_MOODS;
  readonly selectedStyle = { type: 'flat', color: 'primary' } as const;
  readonly unselectedStyle = { type: 'stroked' } as const;

  private readonly _binding = this.target.registerFormBinding();
  private readonly _moods = signal<readonly string[]>([]);

  readonly lockedSignal = toSignal(this.target.formLocked$, { initialValue: false });
  readonly selectedMoodsSignal = computed(() => new Set(this._moods()));

  constructor() {
    cleanSubscription(this.target.formSeed$(this._binding.id).subscribe((value: Maybe<DocExtensionLlmMoodValue>) => this._moods.set(value?.moods ?? [])));
    this.target.setFormValid(this._binding.id, true);
    inject(DestroyRef).onDestroy(() => this._binding.destroy());
  }

  toggleMood(mood: string): void {
    const current = this._moods();
    const next = current.includes(mood) ? current.filter((x) => x !== mood) : [...current, mood];
    this._moods.set(next);
    this.target.setDraftFormValue(this._binding.id, { moods: next });
  }
}

// MARK: Takes Output
/**
 * JSON-safe output of the lab render section.
 */
export interface DocExtensionLlmTakesOutput {
  readonly takes: readonly { readonly id: string; readonly caption: string }[];
}

/**
 * Custom output component of the lab render section. Injects the section store to read the selected run.
 */
@Component({
  selector: 'doc-extension-llm-takes-output',
  template: `
    @if (outputSignal(); as output) {
      @for (take of output.takes; track take.id) {
        <p>
          <span class="dbx-label">{{ take.id }}</span>
          <span class="dbx-hint">{{ take.caption }}</span>
        </p>
      }
    } @else {
      <p class="dbx-hint">No takes yet. Render the prompt.</p>
    }
  `
})
export class DocExtensionLlmTakesOutputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore<unknown, DocExtensionLlmTakesOutput>);
  readonly outputSignal = toSignal(this.sectionStore.selectedOutput$);
}
