import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DemoAppSharedModule } from '@dereekb/demo-components';
import { DEMO_APP_STATES } from './demo.app.router';
import { DemoAppHistoryComponent } from './container/history.component';

@NgModule({
  imports: [
    DemoAppSharedModule,
    UIRouterModule.forChild({
      states: DEMO_APP_STATES
    })
  ],
  declarations: [
    // components
    DemoAppLayoutComponent,
    DemoAppHomeComponent,
    DemoAppHistoryComponent
  ]
})
export class DemoAppModule {}
