import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ServerError, ServerErrorResponseData } from '@dereekb/util';
import { AbstractDbxErrorWidgetComponent } from './error.widget.directive';
import { DbxLabelBlockComponent } from '../layout/text/label.block.component';
import { JsonPipe } from '@angular/common';

@Component({
  template: `
    <dbx-label-block header="Error Code">{{ code }}</dbx-label-block>
    <dbx-label-block header="Error Message">{{ message }}</dbx-label-block>
    @if (serverErrorData) {
      <dbx-label-block header="Error Data">
        <p class="dbx-json">{{ serverErrorData | json }}</p>
      </dbx-label-block>
    }
  `,
  host: {
    class: 'd-block dbx-error-default-error-widget dbx-content-container'
  },
  imports: [DbxLabelBlockComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxErrorDefaultErrorWidgetComponent extends AbstractDbxErrorWidgetComponent<ServerError> {
  get serverErrorData(): ServerErrorResponseData | undefined {
    return this.data.data;
  }
}
