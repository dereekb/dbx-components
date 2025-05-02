import { Component } from '@angular/core';
import { AbstractDbxWidgetComponent } from '@dereekb/dbx-web';
import { MatIcon } from '@angular/material/icon';

export const DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE = 'widgetIconExample';

export interface DocExtensionWidgetIconExampleData {
  icon: string;
  data: object;
}

@Component({
    templateUrl: './widget.icon.example.component.html',
    styleUrls: ['./widget.icon.example.scss'],
    standalone: true,
    imports: [MatIcon]
})
export class DocExtensionWidgetIconExampleComponent extends AbstractDbxWidgetComponent<DocExtensionWidgetIconExampleData> {
  get icon() {
    return this.data.icon;
  }
}
