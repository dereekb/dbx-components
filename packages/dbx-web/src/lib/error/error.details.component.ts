import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Maybe, ReadableError } from '@dereekb/util';
import { DbxErrorWidgetViewComponent } from './error.widget.component';

@Component({
  selector: 'dbx-error-details',
  template: `
    <dbx-error-widget-view [error]="error"></dbx-error-widget-view>
  `,
  host: {
    class: 'd-block dbx-error-details'
  },
  imports: [DbxErrorWidgetViewComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorDetailsComponent {
  @Input()
  error?: Maybe<ReadableError>;
}
