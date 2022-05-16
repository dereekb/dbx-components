import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { DemoRootSharedModule } from '@dereekb/demo-components';
import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
  imports: [
    DemoRootSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    LandingLayoutComponent
  ],
})
export class LandingModule { }
