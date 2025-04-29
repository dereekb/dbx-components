import { DemoRootSharedModule } from 'demo-components';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DemoOnboardLayoutComponent } from './container/layout.component';
import { DemoOnboardTosComponent } from './container/tos.component';
import { DemoOnboardUserComponent } from './container/user.component';
import { DEMO_ONBOARD_STATES } from './demo.onboard.router';

@NgModule({
  imports: [
    DemoRootSharedModule,
    UIRouterModule.forChild({
      states: DEMO_ONBOARD_STATES
    })
  ],
  declarations: [
    // components
    // container
    DemoOnboardLayoutComponent,
    DemoOnboardTosComponent,
    DemoOnboardUserComponent
  ]
})
export class DemoOnboardModule {}
