import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocExtensionHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { STATES } from './doc.extension.router';
import { DbxCalendarRootModule, DbxWidgetModule, DbxWidgetService } from '@dereekb/dbx-web';
import { DocExtensionWidgetComponent } from './container/widget.component';
import { DOC_EXTENSION_WIDGET_EXAMPLE_TYPE, DocExtensionWidgetExampleComponent } from './component/widget.example.component';
import { DocExtensionWidgetIconExampleComponent, DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE } from './component/widget.icon.example.component';

@NgModule({
  imports: [
    DocSharedModule,
    DbxCalendarRootModule,
    DbxWidgetModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // component
    DocExtensionWidgetExampleComponent,
    DocExtensionWidgetIconExampleComponent,
    // container
    DocExtensionLayoutComponent,
    DocExtensionHomeComponent,
    DocExtensionCalendarComponent,
    DocExtensionWidgetComponent
  ]
})
export class DocExtensionModule {
  constructor(dbxWidgetService: DbxWidgetService) {
    dbxWidgetService.register({
      type: DOC_EXTENSION_WIDGET_EXAMPLE_TYPE,
      componentClass: DocExtensionWidgetExampleComponent
    });

    dbxWidgetService.register({
      type: DOC_EXTENSION_WIDGET_ICON_EXAMPLE_TYPE,
      componentClass: DocExtensionWidgetIconExampleComponent
    });
  }
}
