import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './formspace.router';

import { DemoFormSpaceLayoutComponent } from './container/layout.component';
import { DemoFormSpaceViewComponent } from './container/formspace.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    DemoFormSpaceLayoutComponent,
    DemoFormSpaceViewComponent
  ]
})
export class DemoFormSpaceModule {}
