import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, type Signal, viewChild } from '@angular/core';
import { DynamicForm } from '@ng-forge/dynamic-forms';
import type { ValidationError } from '@angular/forms/signals';
import { ForgeWrapperFieldDirective } from './wrapper.field';
import { DbxForgeFormContext } from '../../form/forge.context';

/**
 * Reusable component that renders a nested ng-forge `DynamicForm` for wrapper fields.
 *
 * Injects the parent {@link ForgeWrapperFieldDirective} to read the child form config
 * and two-way bind the form value. Wrapper field components provide themselves as
 * `ForgeWrapperFieldDirective` via {@link provideDbxForgeWrapperFieldDirective}.
 *
 * Exposes the child DynamicForm's validation state via public signals so parent
 * wrapper components can display errors in their own subscript area.
 *
 * @example
 * ```html
 * <dbx-section [headerConfig]="headerConfigSignal()">
 *   <dbx-forge-wrapper-content />
 * </dbx-section>
 * ```
 */
@Component({
  selector: 'dbx-forge-wrapper-content',
  template: `
    @if (wrapper.childConfigSignal()) {
      <form [dynamic-form]="wrapper.childConfigSignal()!" [(value)]="wrapper.childValueSignal"></form>
    }
  `,
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ForgeWrapperContentComponent implements OnInit {
  readonly wrapper = inject(ForgeWrapperFieldDirective);

  private readonly _context = inject(DbxForgeFormContext, { optional: true });
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * Reference to the child DynamicForm instance.
   */
  readonly dynamicForm = viewChild(DynamicForm);

  /**
   * All child form validation errors (recursive). Empty array when the form hasn't rendered yet.
   *
   * Uses `errorSummary` from the field tree which aggregates errors from all child fields,
   * not just root-level errors. This is necessary because wrapper child forms contain
   * nested fields whose validation errors don't appear in the root `errors()` signal.
   */
  readonly errors: Signal<ValidationError.WithFieldTree[]> = computed(() => this.dynamicForm()?.form()?.()?.errorSummary?.() ?? []);

  /**
   * Whether any child form field has been touched (blurred).
   */
  readonly touched: Signal<boolean> = computed(() => this.dynamicForm()?.touched() ?? false);

  /**
   * Whether the child form is currently valid.
   */
  readonly valid: Signal<boolean> = computed(() => this.dynamicForm()?.valid() ?? true);

  /**
   * Whether the child form has any pending async validators.
   */
  readonly pending: Signal<boolean> = computed(() => this.dynamicForm()?.form()?.()?.pending?.() ?? false);

  ngOnInit(): void {
    if (this._context) {
      const unregister = this._context.registerWrapperValidity(this.valid);
      this._destroyRef.onDestroy(unregister);
    }
  }
}
