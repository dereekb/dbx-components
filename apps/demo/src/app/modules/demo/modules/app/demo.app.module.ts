import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';

import { DEMO_APP_STATES } from './demo.app.router';
import { DemoAppHistoryComponent } from './container/history.component';
import { DemoAppSettingsComponent } from './container/settings.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_APP_STATES
    }),
    // components
    DemoAppLayoutComponent,
    DemoAppHomeComponent,
    DemoAppHistoryComponent,
    DemoAppSettingsComponent
  ]
})
export class DemoAppModule {}
