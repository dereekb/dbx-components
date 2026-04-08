import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { DynamicForm, type FormConfig } from '@ng-forge/dynamic-forms';

/**
 * Reusable component that renders a nested ng-forge `DynamicForm` for wrapper fields.
 *
 * This component encapsulates the `<form [dynamic-form]>` rendering and two-way
 * value binding so that wrapper field components only need to place
 * `<dbx-forge-wrapper-content>` inside their layout template.
 *
 * @example
 * ```html
 * <dbx-section [headerConfig]="headerConfigSignal()">
 *   <dbx-forge-wrapper-content [config]="childConfigSignal()" [(value)]="childValueSignal" />
 * </dbx-section>
 * ```
 */
@Component({
  selector: 'dbx-forge-wrapper-content',
  template: `
    @if (config()) {
      <form [dynamic-form]="config()!" [(value)]="value"></form>
    }
  `,
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ForgeWrapperContentComponent {
  /**
   * The ng-forge FormConfig describing the child fields to render.
   */
  readonly config = input.required<FormConfig>();

  /**
   * Two-way bound form value. The parent wrapper component reads/writes
   * this signal to stay in sync with the nested form.
   */
  readonly value = model<Record<string, unknown> | undefined>(undefined);
}
