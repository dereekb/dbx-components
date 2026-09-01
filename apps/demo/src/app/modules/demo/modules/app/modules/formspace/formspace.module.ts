import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './formspace.router';

import { DemoFormSpaceLayoutComponent } from './container/layout.component';
import { DemoFormSpaceListPageComponent } from './container/list.component';
import { DemoFormSpaceListPageRightComponent } from './container/list.right.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    DemoFormSpaceLayoutComponent,
    DemoFormSpaceListPageComponent,
    DemoFormSpaceListPageRightComponent
  ]
})
export class DemoFormSpaceModule {}
