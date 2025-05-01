import { Component } from '@angular/core';
import { AbstractDbxWidgetComponent } from '@dereekb/dbx-web';
import { MatIcon } from '@angular/material/icon';
import { JsonPipe } from '@angular/common';

export const DOC_EXTENSION_WIDGET_EXAMPLE_TYPE = 'widgetExample';

export interface DocExtensionWidgetExampleData {
  icon: string;
  data: object;
}

@Component({
    templateUrl: './widget.example.component.html',
    standalone: true,
    imports: [MatIcon, JsonPipe]
})
export class DocExtensionWidgetExampleComponent extends AbstractDbxWidgetComponent<DocExtensionWidgetExampleData> {
  readonly type = DOC_EXTENSION_WIDGET_EXAMPLE_TYPE;

  get icon() {
    return this.data.icon;
  }
}
