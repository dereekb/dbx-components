import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './profile.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class DemoProfileModule {}
