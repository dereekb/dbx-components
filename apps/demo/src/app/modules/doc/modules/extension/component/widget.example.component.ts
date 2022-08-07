import { OnInit, Component } from '@angular/core';
import { AbstractDbxWidgetComponent } from '@dereekb/dbx-web';

export const DOC_EXTENSION_WIDGET_EXAMPLE_TYPE = 'widgetExample';

export interface DocExtensionWidgetExampleData {
  icon: string;
  data: object;
}

@Component({
  templateUrl: './widget.example.component.html'
})
export class DocExtensionWidgetExampleComponent extends AbstractDbxWidgetComponent<DocExtensionWidgetExampleData> {
  readonly type = DOC_EXTENSION_WIDGET_EXAMPLE_TYPE;

  get icon() {
    return this.data.icon;
  }
}
