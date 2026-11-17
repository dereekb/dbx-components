import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionSnackbarErrorDirective, DbxButtonComponent, type DbxButtonStyle } from '@dereekb/dbx-web';
import { type DbxLlmFlowSectionRunKindConfig } from './llm.flow';
import { dbxLlmFlowSectionRunKinds } from './llm.flow.state';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { DbxLlmFlowSectionRunDirective } from './llm.flow.section.run.directive';

/**
 * Default style of a run button that does not configure its own buttonStyle.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_RUN_BUTTON_STYLE: DbxButtonStyle = { type: 'raised', color: 'primary' };

/**
 * Renders one action button per run kind of the nearest section, stacked in a column. Each button's text, icon and style come from its run
 * kind config. Buttons have no icon unless the kind sets one.
 *
 * Each button is its own dbxAction, with the kind's handler and a dbxLlmFlowSectionRun bridge that records the run in the flow store.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section-run-buttons></dbx-llm-flow-section-run-buttons>
 * ```
 */
@Component({
  selector: 'dbx-llm-flow-section-run-buttons',
  template: `
    @for (k of kindsSignal(); track k.kind) {
      <dbx-button dbxAction dbxActionButton [dbxActionHandler]="k.handler" [dbxLlmFlowSectionRun]="k.kind" dbxActionSnackbarError [text]="k.text" [icon]="k.icon" [buttonStyle]="k.buttonStyle"></dbx-button>
    }
  `,
  host: {
    class: 'dbx-llm-flow-section-run-buttons'
  },
  imports: [DbxButtonComponent, DbxActionDirective, DbxActionButtonDirective, DbxActionHandlerDirective, DbxActionSnackbarErrorDirective, DbxLlmFlowSectionRunDirective]
})
export class DbxLlmFlowSectionRunButtonsComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);

  readonly configSignal = toSignal(this.sectionStore.config$);

  readonly kindsSignal = computed(() =>
    dbxLlmFlowSectionRunKinds(this.configSignal()).map(
      (k: DbxLlmFlowSectionRunKindConfig) =>
        ({
          ...k,
          text: k.text ?? k.kind,
          buttonStyle: k.buttonStyle ?? DEFAULT_DBX_LLM_FLOW_SECTION_RUN_BUTTON_STYLE
        }) as const
    )
  );
}
