import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './demo.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    DemoLayoutComponent,
    DemoHomeComponent
  ]
})
export class DemoModule {}
