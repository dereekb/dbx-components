import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DynamicForm } from '@ng-forge/dynamic-forms';
import { ForgeWrapperFieldDirective } from './wrapper.field';

/**
 * Reusable component that renders a nested ng-forge `DynamicForm` for wrapper fields.
 *
 * Injects the parent {@link ForgeWrapperFieldDirective} to read the child form config
 * and two-way bind the form value. Wrapper field components provide themselves as
 * `ForgeWrapperFieldDirective` via {@link provideDbxForgeWrapperFieldDirective}.
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
export class ForgeWrapperContentComponent {
  readonly wrapper = inject(ForgeWrapperFieldDirective);
}
