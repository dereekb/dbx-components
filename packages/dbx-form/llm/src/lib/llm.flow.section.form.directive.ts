import { Directive, inject } from '@angular/core';
import { clean } from '@dereekb/dbx-core';
import { DbxMutableForm } from '@dereekb/dbx-form';
import { DbxLlmFlowSectionFormBindingTarget } from './llm.flow';
import { bindDbxLlmFlowSectionForm, isDbxLlmFlowSectionFormBound } from './llm.flow.section.form';

/**
 * Binds the form on this element to the nearest section (DbxLlmFlowSectionFormBindingTarget). Skips forms that are already bound.
 *
 * Use it for custom layouts and nested forms, or through hostDirectives on a form component.
 *
 * @example
 * ```html
 * <app-brief-form dbxLlmFlowSectionForm></app-brief-form>
 * ```
 */
@Directive({
  selector: '[dbxLlmFlowSectionForm]',
  standalone: true
})
export class DbxLlmFlowSectionFormDirective<F = unknown> {
  readonly form = inject(DbxMutableForm<F>);
  readonly target = inject(DbxLlmFlowSectionFormBindingTarget<F>);

  constructor() {
    if (!isDbxLlmFlowSectionFormBound(this.form as DbxMutableForm<unknown>)) {
      clean(bindDbxLlmFlowSectionForm({ form: this.form, target: this.target }));
    }
  }
}
