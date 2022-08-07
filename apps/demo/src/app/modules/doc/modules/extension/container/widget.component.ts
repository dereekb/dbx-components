import { OnInit, Component } from '@angular/core';
import { DbxWidgetDataPair } from '@dereekb/dbx-web';
import { DocExtensionWidgetExampleData, DOC_EXTENSION_WIDGET_EXAMPLE_TYPE } from '../component/widget.example.component';

@Component({
  templateUrl: './widget.component.html'
})
export class DocExtensionWidgetComponent implements OnInit {
  readonly examplePair: DbxWidgetDataPair = {
    type: DOC_EXTENSION_WIDGET_EXAMPLE_TYPE,
    data: {
      icon: 'code',
      data: {
        test: true
      }
    } as DocExtensionWidgetExampleData
  };

  ngOnInit(): void {}
}
