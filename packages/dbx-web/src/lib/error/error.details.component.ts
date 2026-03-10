import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe, type ReadableError } from '@dereekb/util';
import { DbxErrorWidgetViewComponent } from './error.widget.component';

/**
 * Displays detailed error information using the error widget system.
 *
 * Wraps {@link DbxErrorWidgetViewComponent} to render a widget for the given {@link ReadableError}.
 * Typically used inside popovers or detail panels to show expanded error data.
 *
 * @example
 * ```html
 * <dbx-error-details [error]="readableError"></dbx-error-details>
 * ```
 */
@Component({
  selector: 'dbx-error-details',
  template: `
    <dbx-error-widget-view [error]="error()"></dbx-error-widget-view>
  `,
  host: {
    class: 'd-block dbx-error-details'
  },
  imports: [DbxErrorWidgetViewComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorDetailsComponent {
  readonly error = input<Maybe<ReadableError>>();
}
