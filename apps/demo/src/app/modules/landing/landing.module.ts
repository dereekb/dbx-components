import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';

import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    LandingLayoutComponent
  ]
})
export class LandingModule {}
