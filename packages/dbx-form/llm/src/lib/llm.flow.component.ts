import { Component, computed, inject } from '@angular/core';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionComponent } from './llm.flow.section.component';

/**
 * An LLM flow that renders every section of its config, in order, each with its config's explicit parentKey.
 *
 * Provides the DbxLlmFlowStore through its DbxLlmFlowDirective host directive. Other content is projected after the sections.
 *
 * @example
 * ```html
 * <dbx-llm-flow [config]="flowConfig" [storageKey]="worldKey()"></dbx-llm-flow>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow',
  template: `
    @for (section of sectionsSignal(); track section.key) {
      <dbx-llm-flow-section [config]="section" [parentKey]="section.parentKey"></dbx-llm-flow-section>
    }
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-llm-flow'
  },
  hostDirectives: [{ directive: DbxLlmFlowDirective, inputs: ['dbxLlmFlow: config', 'storageKey'] }],
  imports: [DbxLlmFlowSectionComponent]
})
export class DbxLlmFlowComponent {
  readonly flowDirective = inject(DbxLlmFlowDirective);

  readonly sectionsSignal = computed(() => this.flowDirective.configSignal()?.sections ?? []);
}
