import { Component } from '@angular/core';
import { DbxWidgetDataPair } from '@dereekb/dbx-web';
import { ListLoadingState, successResult } from '@dereekb/rxjs';
import { map, Observable, of } from 'rxjs';
import { DocExtensionWidgetExampleData, DOC_EXTENSION_WIDGET_EXAMPLE_TYPE } from '../component/widget.example.component';
import { DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE } from '../component/widget.icon.example.component';

@Component({
  templateUrl: './table.component.html'
})
export class DocExtensionTableComponent {}
