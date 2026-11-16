import { Component, computed, Directive, inject, type Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxChipDirective, injectCopyToClipboardFunctionWithSnackbarMessage } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
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
 * Shows the output of the nearest section's selected run.
 *
 * Renders the section config's outputComponent (created in the section's injector, so it can inject the DbxLlmFlowSectionStore). Otherwise
 * shows a string output in a <pre>, or any other JSON output as pretty JSON, with a copy button.
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
    } @else if (outputTextSignal() !== undefined) {
      <div class="dbx-llm-flow-section-output-default">
        <div class="dbx-llm-flow-section-output-bar dbx-flex-bar">
          <span class="dbx-label dbx-small">Output</span>
          @if (isOffBranchSignal()) {
            <dbx-chip [small]="true" color="notice">other branch</dbx-chip>
          }
          <span class="dbx-spacer"></span>
          <dbx-button icon="content_copy" ariaLabel="Copy the output" [iconOnly]="true" [flat]="true" (buttonClick)="copyOutput()"></dbx-button>
        </div>
        <pre class="dbx-llm-flow-section-output-text">{{ outputTextSignal() }}</pre>
      </div>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-output'
  },
  imports: [DbxInjectionComponent, DbxButtonComponent, DbxChipDirective]
})
export class DbxLlmFlowSectionOutputComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  private readonly _copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();

  readonly outputComponentSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.outputComponent)));
  readonly outputTextSignal = toSignal(this.sectionStore.selectedOutput$.pipe(map(dbxLlmFlowSectionOutputText)));
  readonly isOffBranchSignal = toSignal(this.sectionStore.isSelectedRunOffBranch$, { initialValue: false });

  readonly outputInjectionConfigSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => {
    const componentClass = this.outputComponentSignal() as Maybe<Type<unknown>>;
    return componentClass ? { componentClass } : undefined;
  });

  copyOutput(): void {
    const text = this.outputTextSignal();

    if (text != null) {
      void this._copyToClipboard(text);
    }
  }
}
