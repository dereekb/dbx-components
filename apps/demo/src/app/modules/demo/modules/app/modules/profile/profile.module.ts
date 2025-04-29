import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './profile.router';
import { DemoAppSharedModule } from 'demo-components';

@NgModule({
  imports: [
    DemoAppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class DemoProfileModule {}
