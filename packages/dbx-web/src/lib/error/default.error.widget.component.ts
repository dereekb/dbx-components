import { Component } from '@angular/core';
import { ServerError, ServerErrorResponseData } from '@dereekb/util';
import { AbstractDbxErrorWidgetComponent } from './error.widget.directive';

@Component({
  template: `
    <dbx-label-block header="Error Code">{{ code }}</dbx-label-block>
    <dbx-label-block header="Error Data" *ngIf="serverErrorData">
      <p class="dbx-json">{{ serverErrorData | json }}</p>
    </dbx-label-block>
  `,
  host: {
    class: 'd-block dbx-error-default-error-widget dbx-content-container'
  }
})
export class DbxErrorDefaultErrorWidgetComponent extends AbstractDbxErrorWidgetComponent {
  get serverErrorData(): ServerErrorResponseData | undefined {
    return (this.data as ServerError).data;
  }
}
