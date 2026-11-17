import { Component, computed, Directive, inject, type Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxChipDirective, DbxDownloadTextViewComponent, type DownloadTextContent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { type DbxLlmFlowRun } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * Marks content projected into a dbx-llm-flow-section as its output. The section hides its default output when one is present.
 *
 * Projected content can inject the DbxLlmFlowSectionStore to read the selected run.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section [config]="config">
 *   <app-takes dbxLlmFlowSectionOutput></app-takes>
 * </dbx-llm-flow-section>
 * ```
 */
@Directive({
  selector: '[dbxLlmFlowSectionOutput]',
  standalone: true
})
export class DbxLlmFlowSectionOutputDirective {}

/**
 * Converts a run output into the text shown by the default output view: strings as is, anything else as pretty JSON.
 *
 * @param output - The run output.
 * @returns The text, or undefined when there is no output.
 */
export function dbxLlmFlowSectionOutputText(output: unknown): Maybe<string> {
  let text: Maybe<string>;

  if (typeof output === 'string') {
    text = output;
  } else if (output != null) {
    text = JSON.stringify(output, null, 2);
  }

  return text;
}

/**
 * Converts a run into the content of the default output view: a string output as plain text, any other output as pretty JSON. The file is
 * named after the section and the run: "<sectionKey>-output-<runId>.txt" or ".json".
 *
 * @param run - The run.
 * @returns The content, or undefined when there is no run or the run has no output.
 */
export function dbxLlmFlowSectionOutputDownloadTextContent(run: Maybe<Pick<DbxLlmFlowRun, 'id' | 'sectionKey' | 'output'>>): Maybe<DownloadTextContent> {
  const output = run?.output;
  const text = dbxLlmFlowSectionOutputText(output);
  let content: Maybe<DownloadTextContent>;

  if (run != null && text != null) {
    const isJson = typeof output !== 'string';
    const name = `${run.sectionKey}-output-${run.id}.${isJson ? 'json' : 'txt'}`.replaceAll(/[^\w.-]+/g, '-');
    content = { content: text, name, mimeType: isJson ? 'application/json' : 'text/plain' };
  }

  return content;
}

/**
 * Shows the output of the nearest section's selected run.
 *
 * Renders the section config's outputComponent (created in the section's injector, so it can inject the DbxLlmFlowSectionStore). Otherwise
 * shows the output in a dbx-download-text-view (a string as is, any other JSON output as pretty JSON) with copy and download buttons, and
 * marks a selected run that is off the current branch.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-output></dbx-llm-flow-section-output>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-output',
  template: `
    @if (outputInjectionConfigSignal(); as injectionConfig) {
      <dbx-injection [config]="injectionConfig"></dbx-injection>
    } @else if (outputContentSignal(); as content) {
      @if (isOffBranchSignal()) {
        <div class="dbx-llm-flow-section-output-off-branch">
          <dbx-chip [small]="true" color="notice">other branch</dbx-chip>
        </div>
      }
      <dbx-download-text-view class="dbx-llm-flow-section-output-text-view" [content]="content"></dbx-download-text-view>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-output'
  },
  imports: [DbxInjectionComponent, DbxChipDirective, DbxDownloadTextViewComponent]
})
export class DbxLlmFlowSectionOutputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  readonly outputComponentSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.outputComponent)));
  readonly selectedRunSignal = toSignal(this.sectionStore.selectedRun$);
  readonly isOffBranchSignal = toSignal(this.sectionStore.isSelectedRunOffBranch$, { initialValue: false });

  readonly outputInjectionConfigSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => {
    const componentClass = this.outputComponentSignal() as Maybe<Type<unknown>>;
    return componentClass ? { componentClass } : undefined;
  });

  readonly outputContentSignal = computed(() => dbxLlmFlowSectionOutputDownloadTextContent(this.selectedRunSignal()));
}
