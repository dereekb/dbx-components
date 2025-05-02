import { Component } from '@angular/core';
import { DbxWidgetDataPair, DbxContentContainerDirective, DbxContentBorderDirective, DbxWidgetViewComponent, DbxWidgetListGridComponent } from '@dereekb/dbx-web';
import { ListLoadingState, successResult } from '@dereekb/rxjs';
import { map, Observable, of } from 'rxjs';
import { DocExtensionWidgetExampleData, DOC_EXTENSION_WIDGET_EXAMPLE_TYPE } from '../component/widget.example.component';
import { DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE } from '../component/widget.icon.example.component';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './widget.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxWidgetViewComponent, DbxWidgetListGridComponent, JsonPipe]
})
export class DocExtensionWidgetComponent {
  readonly examplePair: DbxWidgetDataPair = {
    type: DOC_EXTENSION_WIDGET_EXAMPLE_TYPE,
    data: {
      icon: 'code',
      data: {
        test: true
      }
    } as DocExtensionWidgetExampleData
  };

  readonly widgetListPairs: DbxWidgetDataPair[] = [
    {
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      data: {
        icon: 'code'
      } as DocExtensionWidgetExampleData
    },
    {
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      data: {
        icon: 'code'
      } as DocExtensionWidgetExampleData
    },
    {
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      data: {
        icon: 'code'
      } as DocExtensionWidgetExampleData
    },
    {
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      data: {
        icon: 'code'
      } as DocExtensionWidgetExampleData
    },
    {
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      data: {
        icon: 'code'
      } as DocExtensionWidgetExampleData
    }
  ];

  readonly state$: Observable<ListLoadingState<DbxWidgetDataPair>> = of(this.widgetListPairs).pipe(
    map((x) => {
      return successResult(x);
    })
  );
}
