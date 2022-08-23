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
import { DocFormComponentsModule } from '../form/doc.form.module';
import { DocExtensionMapboxComponent } from './container/mapbox.component';
import { DbxFormMapboxModule } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { DocExtensionMapboxContentExampleComponent } from './component/mapbox.content.example.component';

@NgModule({
  imports: [
    DocSharedModule,
    DbxCalendarRootModule,
    DocFormComponentsModule,
    DbxWidgetModule,
    DbxMapboxModule,
    NgxMapboxGLModule,
    DbxFormMapboxModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // component
    DocExtensionWidgetExampleComponent,
    DocExtensionWidgetIconExampleComponent,
    DocExtensionMapboxContentExampleComponent,
    // container
    DocExtensionLayoutComponent,
    DocExtensionHomeComponent,
    DocExtensionCalendarComponent,
    DocExtensionWidgetComponent,
    DocExtensionMapboxComponent
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
