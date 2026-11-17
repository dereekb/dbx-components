import { Directive, effect, inject, input, untracked } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxLlmFlowSectionFormBindingTarget, type DbxLlmFlowSectionConfig, type DbxLlmFlowSectionKey } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * Registers a section with the parent DbxLlmFlowStore and provides its DbxLlmFlowSectionStore (also as the DbxLlmFlowSectionFormBindingTarget).
 *
 * The parent section is the explicit parentKey, then the config's parentKey, then the nearest ancestor section.
 */
@Directive({
  selector: '[dbxLlmFlowSection]',
  exportAs: 'dbxLlmFlowSection',
  providers: [DbxLlmFlowSectionStore, { provide: DbxLlmFlowSectionFormBindingTarget, useExisting: DbxLlmFlowSectionStore }],
  standalone: true
})
export class DbxLlmFlowSectionDirective<F = unknown, O = unknown> {
  readonly sectionStore = inject(DbxLlmFlowSectionStore<F, O>);

  readonly dbxLlmFlowSection = input.required<DbxLlmFlowSectionConfig<F, O>>();
  readonly parentKey = input<Maybe<DbxLlmFlowSectionKey>>();

  constructor() {
    effect((onCleanup) => {
      const config = this.dbxLlmFlowSection();
      const parentKey = this.parentKey();
      const destroy = untracked(() => this.sectionStore.register({ config, parentKey }));
      onCleanup(destroy);
    });
  }
}
