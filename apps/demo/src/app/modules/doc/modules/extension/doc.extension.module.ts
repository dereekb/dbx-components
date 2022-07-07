import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocExtensionHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { STATES } from './doc.extension.router';
import { DbxCalendarRootModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    DocSharedModule,
    DbxCalendarRootModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // component
    // container
    DocExtensionLayoutComponent,
    DocExtensionHomeComponent,
    DocExtensionCalendarComponent
  ]
})
export class DocExtensionModule {}
